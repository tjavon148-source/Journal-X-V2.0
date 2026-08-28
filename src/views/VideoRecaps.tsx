import { useMemo, useState } from 'react'
import { CalendarDaysIcon, FileVideoIcon, LayersIcon, PlusIcon } from 'lucide-react'

import type { RecapKind, VideoRecap } from '../types'
import { GLASS } from '../components/Card'
import { pnlClass } from '../components/TradeBits'
import { RecapDetailModal } from '../components/RecapDetailModal'
import { RecapThumb, fmtRuntime } from '../components/RecapThumb'
import { UploadRecapModal } from '../components/UploadRecapModal'
import { fmtDayLabel, fmtShortDate, fmtSignedCurrency } from '../lib/format'
import type { JournalData } from '../hooks/useJournalData'

type KindFilter = 'All' | RecapKind
const KINDS: KindFilter[] = ['All', 'Daily', 'Weekly']

type SortKey = 'recent' | 'longest'

interface Props {
  recaps: VideoRecap[]
  /** Uploads a stand-alone recording and adds it to the library. */
  onUpload: JournalData['addRecap']
  canPersist: boolean
}

export function VideoRecaps({ recaps, onUpload, canPersist }: Props) {
  const [kind, setKind] = useState<KindFilter>('All')
  const [sort, setSort] = useState<SortKey>('recent')
  const [playing, setPlaying] = useState<VideoRecap | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const visible = useMemo(() => {
    return recaps
      .filter((r) => kind === 'All' || r.kind === kind)
      .slice()
      .sort((a, b) =>
        sort === 'longest' ? b.durationSec - a.durationSec : b.date.localeCompare(a.date),
      )
  }, [recaps, kind, sort])

  const totalRuntime = visible.reduce((a, r) => a + r.durationSec, 0)
  const recordings = visible.filter((r) => r.source === 'uploaded').length

  return (
    <div className="space-y-3">
      {/* ------------------------------------------------------- toolbar */}
      <div className={`${GLASS} flex flex-wrap items-end gap-4 p-3`}>
        <ButtonGroup label="Type" options={KINDS} value={kind} onChange={setKind} />
        <ButtonGroup
          label="Sort"
          options={['recent', 'longest'] as SortKey[]}
          value={sort}
          onChange={setSort}
          render={(v) => (v === 'recent' ? 'Most recent' : 'Longest')}
        />

        <div className="ml-auto text-right">
          <p className="text-[11px] tracking-wider text-zinc-400 uppercase">
            {visible.length} {visible.length === 1 ? 'recap' : 'recaps'}
            {recordings > 0 ? ` · ${recordings} with video` : ''}
          </p>
          <p className="text-sm font-semibold text-zinc-200 tabular-nums">
            {fmtRuntime(totalRuntime)} total
          </p>
        </div>

        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white active:scale-[0.98]"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          Upload Video Recap
        </button>
      </div>

      {/* ------------------------------------------------------- library */}
      {visible.length === 0 ? (
        <div className={`${GLASS} px-3 py-16 text-center text-sm text-zinc-500`}>
          No recaps of this type yet. Upload a recording to start the library.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map((recap) => (
            <RecapCard key={recap.id} recap={recap} onOpen={() => setPlaying(recap)} />
          ))}
        </div>
      )}

      <RecapDetailModal recap={playing} onClose={() => setPlaying(null)} />

      <UploadRecapModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSave={onUpload}
        canPersist={canPersist}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- card */

function RecapCard({ recap, onOpen }: { recap: VideoRecap; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${GLASS} group flex flex-col overflow-hidden text-left transition hover:border-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-500/50 focus-visible:outline-none`}
    >
      <RecapThumb recap={recap} />

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <KindBadge kind={recap.kind} />
          {recap.videoUrl ? (
            <span
              title="Has a recording"
              className="inline-flex items-center gap-1 rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-zinc-700"
            >
              <FileVideoIcon className="size-3" aria-hidden="true" />
              Video
            </span>
          ) : null}
          <span className="ml-auto text-[11px] text-zinc-500 tabular-nums">
            {recap.endDate
              ? `${fmtShortDate(recap.date)} – ${fmtShortDate(recap.endDate)}`
              : fmtDayLabel(recap.date)}
          </span>
        </div>

        <h3 className="text-sm leading-snug font-semibold text-zinc-100">{recap.title}</h3>

        <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500">{recap.notes}</p>

        <div className="mt-auto flex items-center justify-between border-t border-zinc-800 pt-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-zinc-500">
            <LayersIcon className="size-3" aria-hidden="true" />
            {recap.tradeCount} {recap.tradeCount === 1 ? 'trade' : 'trades'}
          </span>
          <span className={`font-semibold tabular-nums ${pnlClass(recap.netPnl)}`}>
            {fmtSignedCurrency(recap.netPnl)}
          </span>
        </div>
      </div>
    </button>
  )
}

function KindBadge({ kind }: { kind: RecapKind }) {
  const weekly = kind === 'Weekly'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ${
        weekly
          ? 'bg-zinc-100/10 text-zinc-200 ring-zinc-500/40'
          : 'bg-zinc-800/80 text-zinc-400 ring-zinc-700'
      }`}
    >
      {weekly ? (
        <LayersIcon className="size-3" aria-hidden="true" />
      ) : (
        <CalendarDaysIcon className="size-3" aria-hidden="true" />
      )}
      {kind}
    </span>
  )
}

/* -------------------------------------------------------------- filters */

interface ButtonGroupProps<T extends string> {
  label: string
  options: T[]
  value: T
  onChange: (next: T) => void
  render?: (value: T) => string
}

function ButtonGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  render = (v) => v,
}: ButtonGroupProps<T>) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
        {label}
      </p>
      <div
        role="group"
        aria-label={label}
        className="flex rounded-lg border border-zinc-700/70 bg-zinc-950/50 p-0.5"
      >
        {options.map((option) => {
          const active = option === value
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                active ? 'bg-zinc-700/80 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {render(option)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
