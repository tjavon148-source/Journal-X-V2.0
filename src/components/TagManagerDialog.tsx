import { useEffect, useState } from 'react'
import {
  AlertTriangleIcon,
  CheckIcon,
  LoaderIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { TagRecord } from '../lib/rows'

/** A staged row. `id === null` means "not in the database yet". */
interface DraftTag {
  id: string | null
  label: string
}

type Kind = TagRecord['kind']

interface Props {
  open: boolean
  tags: TagRecord[]
  onCreate: (kind: Kind, label: string) => Promise<unknown>
  onRename: (id: string, label: string) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  onClose: () => void
}

/**
 * Edits the `tags` table.
 *
 * Changes are staged locally and only written on Save, so an accidental delete
 * can be abandoned by cancelling. Save then diffs the draft against what was
 * loaded and issues one insert/update/delete per actual change, rather than
 * clearing and rewriting the table — existing tag ids stay stable, which
 * matters because trades reference tags by name and a churned table would make
 * that history harder to reason about.
 */
export function TagManagerDialog({ open, tags, onCreate, onRename, onDelete, onClose }: Props) {
  const [setups, setSetups] = useState<DraftTag[]>([])
  const [mistakes, setMistakes] = useState<DraftTag[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-seed from the live table each time the dialog opens, so a cancelled
  // edit never leaks into the next session.
  useEffect(() => {
    if (!open) return
    const toDraft = (kind: Kind) =>
      tags.filter((t) => t.kind === kind).map((t) => ({ id: t.id, label: t.label }))
    setSetups(toDraft('setup'))
    setMistakes(toDraft('mistake'))
    setError(null)
    setSaving(false)
  }, [open, tags])

  const original = (kind: Kind) => tags.filter((t) => t.kind === kind)

  const changes = (kind: Kind, draft: DraftTag[]) => {
    const before = original(kind)
    const keptIds = new Set(draft.map((d) => d.id).filter(Boolean))
    return {
      inserts: draft.filter((d) => d.id === null),
      deletes: before.filter((t) => !keptIds.has(t.id)),
      renames: draft.filter(
        (d) => d.id !== null && before.find((t) => t.id === d.id)?.label !== d.label,
      ),
    }
  }

  const setupOps = changes('setup', setups)
  const mistakeOps = changes('mistake', mistakes)
  const pending =
    setupOps.inserts.length +
    setupOps.deletes.length +
    setupOps.renames.length +
    mistakeOps.inserts.length +
    mistakeOps.deletes.length +
    mistakeOps.renames.length

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      for (const [kind, ops] of [
        ['setup', setupOps],
        ['mistake', mistakeOps],
      ] as const) {
        for (const row of ops.deletes) await onDelete(row.id)
        for (const row of ops.renames) await onRename(row.id as string, row.label.trim())
        for (const row of ops.inserts) await onCreate(kind, row.label.trim())
      }
      onClose()
    } catch (err) {
      // Some operations may already have committed; re-seeding on the next open
      // shows exactly what landed rather than guessing.
      setError(err instanceof Error ? err.message : 'Could not save tags.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden border border-zinc-800 bg-zinc-900/85 p-0 shadow-2xl ring-0 backdrop-blur-2xl sm:max-w-2xl">
        <DialogHeader className="border-b border-zinc-800 px-5 py-4">
          <DialogTitle className="text-base">Tag Manager</DialogTitle>
          <DialogDescription>
            Stored in the <code className="text-zinc-400">tags</code> table. Drives the Log Trade
            form and the History filters.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[calc(88vh-170px)] gap-6 overflow-y-auto p-5 sm:grid-cols-2">
          <TagList
            heading="Setup Tags"
            hint="Price-action patterns you trade."
            tags={setups}
            onChange={setSetups}
          />
          <TagList
            heading="Mistake & Emotion Tags"
            hint="Execution errors and the states behind them."
            tags={mistakes}
            onChange={setMistakes}
          />
        </div>

        <DialogFooter className="mx-0 mb-0 items-center border-t border-zinc-800 bg-zinc-950/40 px-5 py-4 sm:justify-between">
          <p
            className={`text-[11px] ${error ? 'text-[#d03b3b]' : 'text-zinc-500'}`}
            role={error ? 'alert' : undefined}
          >
            {error ? (
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangleIcon className="size-3" aria-hidden="true" />
                {error}
              </span>
            ) : (
              'Deleting a tag only affects future selection — trades already tagged keep it.'
            )}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" disabled={pending === 0 || saving} onClick={() => void save()}>
              {saving ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                `Save${pending > 0 ? ` (${pending})` : ''}`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------- list */

interface TagListProps {
  heading: string
  hint: string
  tags: DraftTag[]
  onChange: (next: DraftTag[]) => void
}

function TagList({ heading, hint, tags, onChange }: TagListProps) {
  const [adding, setAdding] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  /** Rejects blanks and case-insensitive duplicates, ignoring the row being renamed. */
  const validate = (value: string, exceptIndex?: number): string | null => {
    const trimmed = value.trim()
    if (trimmed === '') return 'Tag cannot be empty'
    const clash = tags.some(
      (t, i) => i !== exceptIndex && t.label.toLowerCase() === trimmed.toLowerCase(),
    )
    return clash ? 'That tag already exists' : null
  }

  const commitAdd = () => {
    const problem = validate(adding)
    if (problem) {
      setError(problem)
      return
    }
    onChange([...tags, { id: null, label: adding.trim() }])
    setAdding('')
    setError(null)
  }

  const commitEdit = (index: number) => {
    const problem = validate(editingValue, index)
    if (problem) {
      setError(problem)
      return
    }
    onChange(tags.map((t, i) => (i === index ? { ...t, label: editingValue.trim() } : t)))
    setEditingIndex(null)
    setError(null)
  }

  return (
    <section>
      <h3 className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">{heading}</h3>
      <p className="mt-0.5 text-[11px] text-zinc-600">{hint}</p>

      <ul className="mt-3 space-y-1.5">
        {tags.map((tag, i) => (
          <li key={tag.id ?? `new-${i}`}>
            {editingIndex === i ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={editingValue}
                  onChange={(e) => {
                    setEditingValue(e.target.value)
                    setError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(i)
                    if (e.key === 'Escape') {
                      setEditingIndex(null)
                      setError(null)
                    }
                  }}
                  aria-label={`Rename ${tag.label}`}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-600 bg-zinc-950/60 px-2.5 text-sm text-zinc-100 focus-visible:border-zinc-400 focus-visible:outline-none"
                />
                <IconButton label="Save name" onClick={() => commitEdit(i)}>
                  <CheckIcon className="size-3.5" />
                </IconButton>
                <IconButton
                  label="Cancel rename"
                  onClick={() => {
                    setEditingIndex(null)
                    setError(null)
                  }}
                >
                  <XIcon className="size-3.5" />
                </IconButton>
              </div>
            ) : (
              <div className="group flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/50 py-1.5 pr-1.5 pl-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{tag.label}</span>
                {tag.id === null ? (
                  <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    new
                  </span>
                ) : null}
                <IconButton
                  label={`Rename ${tag.label}`}
                  onClick={() => {
                    setEditingIndex(i)
                    setEditingValue(tag.label)
                    setError(null)
                  }}
                >
                  <PencilIcon className="size-3.5" />
                </IconButton>
                <IconButton
                  label={`Delete ${tag.label}`}
                  danger
                  onClick={() => onChange(tags.filter((_, j) => j !== i))}
                >
                  <Trash2Icon className="size-3.5" />
                </IconButton>
              </div>
            )}
          </li>
        ))}

        {tags.length === 0 ? (
          <li className="rounded-lg border border-dashed border-zinc-800 px-2.5 py-3 text-center text-xs text-zinc-600">
            No tags yet
          </li>
        ) : null}
      </ul>

      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={adding}
          onChange={(e) => {
            setAdding(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && commitAdd()}
          placeholder="Add a tag…"
          aria-label={`Add a tag to ${heading}`}
          className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-700/70 bg-zinc-950/50 px-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:border-zinc-500 focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={commitAdd}
          aria-label={`Add tag to ${heading}`}
          className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 transition hover:bg-white"
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      {error ? <p className="mt-1.5 text-[11px] text-[#d03b3b]">{error}</p> : null}
    </section>
  )
}

function IconButton({
  label,
  onClick,
  children,
  danger = false,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex size-7 shrink-0 items-center justify-center rounded-md transition ${
        danger
          ? 'text-zinc-500 hover:bg-[#d03b3b]/15 hover:text-[#d03b3b]'
          : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}
