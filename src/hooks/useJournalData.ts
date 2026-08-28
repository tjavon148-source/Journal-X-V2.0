import { useCallback, useEffect, useMemo, useState } from 'react'

import type { DailyNote, Trade } from '../types'
import { isSupabaseConfigured, requireSupabase, supabase } from '../lib/supabase'
import { uploadFiles, type UploadProgress } from '../lib/storage'
import {
  noteFromRow,
  noteToUpsert,
  recapFromRow,
  recapToInsert,
  tagFromRow,
  tradeFromRow,
  tradeToInsert,
  type DailyNoteRow,
  type StoredRecap,
  type TagRecord,
  type TagRow,
  type TradeRow,
  type VideoRecapRow,
} from '../lib/rows'
import { vocabularyFromTags, type TagVocabulary } from '../lib/tags'

export type JournalStatus = 'unconfigured' | 'loading' | 'ready' | 'error'

/**
 * True when a query failed because the table is not in the database.
 *
 * Postgres raises 42P01 for an undefined table; PostgREST answers PGRST205 when
 * the name is not in its schema cache. Either means "not migrated yet", which
 * is recoverable, unlike a permissions or network failure.
 */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || error.code === 'PGRST205'
}

export interface JournalData {
  status: JournalStatus
  error: string | null
  trades: Trade[]
  notes: DailyNote[]
  tags: TagRecord[]
  /** Recaps with a recording behind them; the rest of the library is derived. */
  uploadedRecaps: StoredRecap[]
  /** Tag labels grouped for the form and filters; falls back to defaults when empty. */
  vocabulary: TagVocabulary
  /** True once loaded with nothing in either table. */
  isEmpty: boolean
  refresh: () => Promise<void>
  /** Uploads files, inserts the trade, and prepends it to local state. */
  addTrade: (
    draft: Omit<Trade, 'id' | 'attachments'>,
    files: File[],
    onProgress?: (progress: UploadProgress) => void,
  ) => Promise<Trade>
  /** Uploads a stand-alone recap recording and inserts its row. */
  addRecap: (
    draft: Omit<StoredRecap, 'id' | 'videoUrl'>,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
  ) => Promise<StoredRecap>
  /** Upserts a note on its `date` and merges the stored row into local state. */
  saveNote: (note: DailyNote) => Promise<void>
  /** Local-only note edit; persistence is debounced by the caller. */
  setNotes: (notes: DailyNote[]) => void
  createTag: (kind: TagRecord['kind'], label: string) => Promise<TagRecord>
  renameTag: (id: string, label: string) => Promise<void>
  deleteTag: (id: string) => Promise<void>
}

/**
 * Loads the journal from Supabase once on mount and owns every mutation.
 *
 * Every view reads from here, so a trade inserted in the Log Trade dialog shows
 * up on the dashboard, calendar and history without a refetch.
 */
export function useJournalData(): JournalData {
  const [status, setStatus] = useState<JournalStatus>(
    isSupabaseConfigured ? 'loading' : 'unconfigured',
  )
  const [error, setError] = useState<string | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [notes, setNotes] = useState<DailyNote[]>([])
  const [tags, setTags] = useState<TagRecord[]>([])
  const [uploadedRecaps, setUploadedRecaps] = useState<StoredRecap[]>([])

  const refresh = useCallback(async () => {
    if (!supabase) {
      setStatus('unconfigured')
      return
    }

    setStatus('loading')
    setError(null)

    const [tradeRes, noteRes, tagRes, recapRes] = await Promise.all([
      supabase.from('trades').select('*').order('execution_time', { ascending: false }),
      supabase.from('daily_notes').select('*').order('date', { ascending: false }),
      supabase.from('tags').select('*'),
      supabase.from('video_recaps').select('*').order('date', { ascending: false }),
    ])

    const failure = tradeRes.error ?? noteRes.error ?? tagRes.error
    if (failure) {
      setError(failure.message)
      setStatus('error')
      return
    }

    setTrades(((tradeRes.data as TradeRow[] | null) ?? []).map(tradeFromRow))
    setNotes(((noteRes.data as DailyNoteRow[] | null) ?? []).map(noteFromRow))
    setTags(((tagRes.data as TagRow[] | null) ?? []).map(tagFromRow))

    // `video_recaps` is an additive migration. A project still on the original
    // schema should show its derived library rather than an error page, so a
    // missing table is treated as an empty one — any other failure is not.
    if (recapRes.error && !isMissingTable(recapRes.error)) {
      setError(recapRes.error.message)
      setStatus('error')
      return
    }
    setUploadedRecaps(((recapRes.data as VideoRecapRow[] | null) ?? []).map(recapFromRow))

    setStatus('ready')
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addTrade = useCallback(
    async (
      draft: Omit<Trade, 'id' | 'attachments'>,
      files: File[],
      onProgress?: (progress: UploadProgress) => void,
    ): Promise<Trade> => {
      const client = requireSupabase()

      // Upload first: a trade row pointing at files that failed to upload is
      // worse than no row at all.
      const attachments = await uploadFiles(
        client,
        files,
        'trades',
        draft.entryTime,
        onProgress,
      )

      const { data, error: insertError } = await client
        .from('trades')
        .insert(tradeToInsert({ ...draft, attachments }))
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)

      const saved = tradeFromRow(data as TradeRow)
      setTrades((current) =>
        [saved, ...current].sort((a, b) => b.entryTime.localeCompare(a.entryTime)),
      )
      return saved
    },
    [],
  )

  const saveNote = useCallback(async (note: DailyNote) => {
    const client = requireSupabase()

    const { data, error: upsertError } = await client
      .from('daily_notes')
      .upsert(noteToUpsert(note), { onConflict: 'date' })
      .select()
      .single()

    if (upsertError) throw new Error(upsertError.message)

    // Adopt the stored row's id, so a note created locally stops being a
    // temporary client-side record and later saves update rather than insert.
    const stored = noteFromRow(data as DailyNoteRow)
    setNotes((current) => current.map((n) => (n.date === stored.date ? stored : n)))
  }, [])

  /* ------------------------------------------------------------- recaps */

  const addRecap = useCallback(
    async (
      draft: Omit<StoredRecap, 'id' | 'videoUrl'>,
      file: File,
      onProgress?: (progress: UploadProgress) => void,
    ): Promise<StoredRecap> => {
      const client = requireSupabase()

      const [videoUrl] = await uploadFiles(client, [file], 'recaps', draft.date, onProgress)

      const { data, error: insertError } = await client
        .from('video_recaps')
        .insert(recapToInsert({ ...draft, videoUrl }))
        .select()
        .single()

      if (insertError) {
        throw new Error(
          isMissingTable(insertError)
            ? 'The video_recaps table does not exist yet. Run the migration in supabase/schema.sql, then try again — your recording is already uploaded.'
            : insertError.message,
        )
      }

      const saved = recapFromRow(data as VideoRecapRow)
      setUploadedRecaps((current) =>
        [saved, ...current].sort((a, b) => b.date.localeCompare(a.date)),
      )
      return saved
    },
    [],
  )

  /* --------------------------------------------------------------- tags */

  const createTag = useCallback(
    async (kind: TagRecord['kind'], label: string): Promise<TagRecord> => {
      const client = requireSupabase()
      const { data, error: insertError } = await client
        .from('tags')
        .insert({ name: label, category: kind })
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)

      const created = tagFromRow(data as TagRow)
      setTags((current) => [...current, created])
      return created
    },
    [],
  )

  const renameTag = useCallback(async (id: string, label: string) => {
    const client = requireSupabase()
    const { data, error: updateError } = await client
      .from('tags')
      .update({ name: label })
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw new Error(updateError.message)

    const updated = tagFromRow(data as TagRow)
    setTags((current) => current.map((t) => (t.id === id ? updated : t)))
  }, [])

  const deleteTag = useCallback(async (id: string) => {
    const client = requireSupabase()
    const { error: deleteError } = await client.from('tags').delete().eq('id', id)
    if (deleteError) throw new Error(deleteError.message)
    setTags((current) => current.filter((t) => t.id !== id))
  }, [])

  const vocabulary = useMemo(() => vocabularyFromTags(tags), [tags])

  const isEmpty = status === 'ready' && trades.length === 0 && notes.length === 0

  return useMemo(
    () => ({
      status,
      error,
      trades,
      notes,
      tags,
      uploadedRecaps,
      vocabulary,
      isEmpty,
      refresh,
      addTrade,
      addRecap,
      saveNote,
      setNotes,
      createTag,
      renameTag,
      deleteTag,
    }),
    [
      status,
      error,
      trades,
      notes,
      tags,
      uploadedRecaps,
      vocabulary,
      isEmpty,
      refresh,
      addTrade,
      addRecap,
      saveNote,
      createTag,
      renameTag,
      deleteTag,
    ],
  )
}
