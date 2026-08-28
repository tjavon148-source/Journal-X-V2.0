import { FileVideoIcon } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { VideoRecap } from '../types'
import { pnlClass } from './TradeBits'
import { RecapThumb, fmtRuntime } from './RecapThumb'
import { fmtDayLabel, fmtShortDate, fmtSignedCurrency } from '../lib/format'
import { fileNameFromUrl } from '../lib/media'

interface Props {
  recap: VideoRecap | null
  onClose: () => void
}

export function RecapDetailModal({ recap, onClose }: Props) {
  return (
    <Dialog open={recap !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden border border-zinc-800 bg-zinc-900/85 p-0 shadow-2xl ring-0 backdrop-blur-2xl sm:max-w-3xl">
        {recap ? <RecapDetail recap={recap} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function RecapDetail({ recap }: { recap: VideoRecap }) {
  return (
    <>
      <DialogHeader className="border-b border-zinc-800 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <DialogTitle className="text-base">{recap.title}</DialogTitle>
            <DialogDescription className="mt-1">
              {recap.kind} ·{' '}
              {recap.endDate
                ? `${fmtShortDate(recap.date)} – ${fmtShortDate(recap.endDate)}`
                : fmtDayLabel(recap.date)}{' '}
              · {fmtRuntime(recap.durationSec)} · {recap.tradeCount}{' '}
              {recap.tradeCount === 1 ? 'trade' : 'trades'}
            </DialogDescription>
          </div>
          <p className={`text-2xl font-semibold tabular-nums ${pnlClass(recap.netPnl)}`}>
            {fmtSignedCurrency(recap.netPnl)}
          </p>
        </div>
      </DialogHeader>

      <div className="max-h-[calc(88vh-92px)] space-y-5 overflow-y-auto p-5">
        {/* An uploaded recap plays; a derived one shows its equity curve and
            says plainly that there is no recording behind it. */}
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          {recap.videoUrl ? (
            <video
              controls
              autoPlay
              preload="metadata"
              src={recap.videoUrl}
              aria-label={`Recording for ${recap.title}`}
              className="aspect-video w-full rounded-lg bg-black"
            />
          ) : (
            <RecapThumb recap={recap} tall />
          )}

          <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px] text-zinc-500">
            <FileVideoIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {recap.videoUrl
                ? fileNameFromUrl(recap.videoUrl, 'recording')
                : 'No recording uploaded for this period'}
            </span>
            <span className="ml-auto shrink-0 text-zinc-600 tabular-nums">
              {recap.durationSec > 0 ? fmtRuntime(recap.durationSec) : '—'}
              {recap.videoUrl ? '' : ' · estimated'}
            </span>
          </div>
        </div>

        <section>
          <h3 className="mb-2 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
            Recap Notes
          </h3>
          <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm leading-relaxed text-zinc-300">
            {recap.notes}
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
            Period Summary
          </h3>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
            <Cell label="Type" value={recap.kind} />
            <Cell label="Trades" value={String(recap.tradeCount)} />
            <Cell label="Runtime" value={fmtRuntime(recap.durationSec)} />
            <Cell
              label="Net P&L"
              value={fmtSignedCurrency(recap.netPnl)}
              className={pnlClass(recap.netPnl)}
            />
          </dl>
        </section>
      </div>
    </>
  )
}

function Cell({
  label,
  value,
  className = 'text-zinc-100',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="bg-zinc-950/60 px-3 py-2.5">
      <dt className="text-[10px] tracking-wider text-zinc-500 uppercase">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold tabular-nums ${className}`}>{value}</dd>
    </div>
  )
}
