import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangleIcon, CheckIcon, LoaderIcon, PlusIcon } from 'lucide-react'

import type { DailyNote, DayStats, Sentiment, Trade } from '../types'
import { GLASS } from '../components/Card'
import { AutoTextarea } from '../components/AutoTextarea'
import { DailyContextHeader } from '../components/DailyContextHeader'
import { TradeDetailModal } from '../components/TradeDetailModal'
import { TradeGalleryCard } from '../components/TradeGalleryCard'
import { pnlClass } from '../components/TradeBits'
import { fmtDayLabel, fmtSignedCurrency, toISODate } from '../lib/format'
import { SENTIMENTS } from '../lib/tags'

interface Props {
  notes: DailyNote[]
  onChange: (notes: DailyNote[]) => void
  /** Sessions derived from live trades, so a note can show the day it describes. */
  days: DayStats[]
  /** Upserts the note into `daily_notes`, keyed on its date. */
  onPersist: (note: DailyNote) => Promise<void>
  /** False when there is no database to write to. */
  canPersist: boolean
}

export function Notes({ notes, onChange, days, onPersist, canPersist }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null)
  const [inspecting, setInspecting] = useState<Trade | null>(null)

  const statsByDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
  const selected = notes.find((n) => n.id === selectedId) ?? notes[0] ?? null
  const stats = selected ? statsByDate.get(selected.date) : undefined

  const update = (patch: Partial<DailyNote>) => {
    if (!selected) return
    onChange(notes.map((n) => (n.id === selected.id ? { ...n, ...patch } : n)))
  }

  const addNote = () => {
    // Date the new entry to the most recent session that isn't journaled yet,
    // falling back to today — the common case is writing up the last session.
    const journaled = new Set(notes.map((n) => n.date))
    const openSession = [...days].reverse().find((d) => !journaled.has(d.date))
    const date = openSession?.date ?? toISODate(new Date(2026, 7, 27))

    const note: DailyNote = {
      id: `N-new-${Date.now()}`,
      date,
      title: `${fmtDayLabel(date)} — Session Journal`,
      sentiment: 'Trending',
      preMarketPlan: '',
      executionReview: '',
      lessonsLearned: '',
    }

    onChange([note, ...notes].sort((a, b) => b.date.localeCompare(a.date)))
    setSelectedId(note.id)
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* ------------------------------------------------------- sidebar */}
      <aside className={`${GLASS} flex max-h-[calc(100vh-140px)] flex-col overflow-hidden`}>
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 p-3">
          <h2 className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
            Daily Notes
          </h2>
          <span className="text-[11px] text-zinc-500">{notes.length}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {notes.map((note) => {
              const active = selected?.id === note.id
              const dayStats = statsByDate.get(note.date)
              return (
                <li key={note.id}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setSelectedId(note.id)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                      active ? 'bg-zinc-700/60 ring-1 ring-zinc-600/60' : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Win/loss dot: outcome readable before any number is parsed. */}
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: !dayStats
                          ? '#3f3f46'
                          : dayStats.netPnl >= 0
                            ? '#0ca30c'
                            : '#d03b3b',
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-medium text-zinc-200 tabular-nums">
                          {fmtDayLabel(note.date)}
                        </span>
                        {dayStats ? (
                          <span className={`tabular-nums ${pnlClass(dayStats.netPnl)}`}>
                            {fmtSignedCurrency(dayStats.netPnl)}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                        {note.sentiment}
                        {dayStats
                          ? ` · ${dayStats.tradeCount} ${dayStats.tradeCount === 1 ? 'trade' : 'trades'}`
                          : ' · no trades'}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="border-t border-zinc-800 p-2">
          <button
            type="button"
            onClick={addNote}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99]"
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Add Daily Note
          </button>
        </div>
      </aside>

      {/* -------------------------------------------------------- editor */}
      {selected ? (
        <section className={`${GLASS} flex flex-col gap-5 p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold text-zinc-50">{selected.title}</h2>
              <p className="mt-1 text-xs text-zinc-500">{fmtDayLabel(selected.date)}</p>
            </div>
            <SaveIndicator note={selected} onPersist={onPersist} canPersist={canPersist} />
          </div>

          <DailyContextHeader stats={stats} />

          <div>
            <p className="mb-1.5 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
              Session Sentiment / Market Condition
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SENTIMENTS.map((option) => {
                const active = selected.sentiment === option
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ sentiment: option as Sentiment })}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 backdrop-blur-md transition ${
                      active
                        ? 'bg-zinc-100/15 text-zinc-100 ring-zinc-400/50'
                        : 'bg-zinc-950/40 text-zinc-400 ring-zinc-700/70 hover:bg-zinc-900/60 hover:text-zinc-200'
                    }`}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>

          <NoteSection
            label="Pre-Market Plan"
            placeholder="Levels, bias, and the setups worth taking today."
            value={selected.preMarketPlan}
            onChange={(v) => update({ preMarketPlan: v })}
          />
          <NoteSection
            label="Execution Review"
            placeholder="What actually happened, and how closely it followed the plan."
            value={selected.executionReview}
            onChange={(v) => update({ executionReview: v })}
          />
          <NoteSection
            label="Lessons Learned"
            placeholder="The one thing to carry into the next session."
            value={selected.lessonsLearned}
            onChange={(v) => update({ lessonsLearned: v })}
          />

          {/* ------------------------------------------ session trades */}
          <section className="border-t border-zinc-800 pt-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
                Trades Taken This Session
              </h3>
              <span className="text-[11px] text-zinc-600">
                {stats?.tradeCount ?? 0} on {fmtDayLabel(selected.date)}
              </span>
            </div>

            {!stats || stats.trades.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                No trades were executed on this date.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {stats.trades.map((trade) => (
                  <TradeGalleryCard
                    key={trade.id}
                    trade={trade}
                    onOpen={() => setInspecting(trade)}
                  />
                ))}
              </div>
            )}
          </section>
        </section>
      ) : (
        <section className={`${GLASS} flex items-center justify-center p-16`}>
          <p className="text-sm text-zinc-500">No notes yet — add one to start journaling.</p>
        </section>
      )}

      <TradeDetailModal trade={inspecting} onClose={() => setInspecting(null)} />
    </div>
  )
}

/* ------------------------------------------------------------------ bits */

type SaveState = 'idle' | 'pending' | 'saved' | 'error' | 'offline'

/**
 * Debounced auto-save. Edits settle for a beat, then upsert into `daily_notes`
 * keyed on the note's date.
 *
 * The first render for a given note must NOT write — mounting or switching
 * notes is not an edit, and writing then would upsert every note the user
 * merely looked at.
 */
function SaveIndicator({
  note,
  onPersist,
  canPersist,
}: {
  note: DailyNote
  onPersist: (note: DailyNote) => Promise<void>
  canPersist: boolean
}) {
  const [state, setState] = useState<SaveState>(canPersist ? 'idle' : 'offline')
  const [message, setMessage] = useState<string | null>(null)
  const lastSaved = useRef<string | null>(null)

  const signature = `${note.date}|${note.sentiment}|${note.preMarketPlan}|${note.executionReview}|${note.lessonsLearned}`

  useEffect(() => {
    if (!canPersist) {
      setState('offline')
      return
    }

    // Seed the baseline on first sight of this note, without saving it.
    if (lastSaved.current === null || !lastSaved.current.startsWith(`${note.date}|`)) {
      lastSaved.current = signature
      setState('idle')
      return
    }

    if (lastSaved.current === signature) return

    setState('pending')
    const timer = setTimeout(async () => {
      try {
        await onPersist(note)
        lastSaved.current = signature
        setState('saved')
        setMessage(null)
      } catch (err) {
        setState('error')
        setMessage(err instanceof Error ? err.message : 'Save failed')
      }
    }, 900)

    return () => clearTimeout(timer)
  }, [signature, note, onPersist, canPersist])

  const label: Record<SaveState, string> = {
    idle: 'Auto-save on',
    pending: 'Saving…',
    saved: 'Saved',
    error: message ?? 'Save failed',
    offline: 'Not connected',
  }

  return (
    <span
      aria-live="polite"
      title={message ?? undefined}
      className={`inline-flex max-w-[220px] shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] ${
        state === 'error' ? 'text-[#d03b3b]' : 'text-zinc-500'
      }`}
    >
      {state === 'pending' ? (
        <LoaderIcon className="size-3 animate-spin" aria-hidden="true" />
      ) : state === 'error' ? (
        <AlertTriangleIcon className="size-3" aria-hidden="true" />
      ) : state === 'saved' ? (
        <CheckIcon className="size-3 text-[#0ca30c]" aria-hidden="true" />
      ) : (
        <CheckIcon className="size-3 text-zinc-600" aria-hidden="true" />
      )}
      <span className="truncate">{label[state]}</span>
    </span>
  )
}

interface NoteSectionProps {
  label: string
  placeholder: string
  value: string
  onChange: (next: string) => void
}

function NoteSection({ label, placeholder, value, onChange }: NoteSectionProps) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
        {label}
      </p>
      <AutoTextarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        ariaLabel={label}
        minRows={3}
      />
    </div>
  )
}
