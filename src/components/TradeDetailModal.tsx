import { ImageIcon } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Trade } from '../types'
import { MediaAttachment, MediaKindIcon, describeAttachments } from './MediaAttachment'
import { MistakeTag, SetupTag, SideBadge, pnlClass } from './TradeBits'
import {
  fmtDayLabel,
  fmtDuration,
  fmtPrice,
  fmtSignedCurrency,
  fmtSignedPoints,
  fmtTime,
} from '../lib/format'
import { netPoints, POINT_VALUE } from '../lib/instruments'
import { fileNameFromUrl, isVideoUrl } from '../lib/media'

interface Props {
  trade: Trade | null
  onClose: () => void
}

export function TradeDetailModal({ trade, onClose }: Props) {
  return (
    <Dialog open={trade !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden border border-zinc-800 bg-zinc-900/85 p-0 shadow-2xl ring-0 backdrop-blur-2xl sm:max-w-3xl">
        {trade ? <TradeDetail trade={trade} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function TradeDetail({ trade }: { trade: Trade }) {
  const points = netPoints(trade.entryPrice, trade.exitPrice, trade.direction)
  // The fixture stores net P&L and the commission it already absorbed, so gross
  // is recovered rather than recomputed — the two can never disagree this way.
  const gross = trade.pnl + trade.commission

  return (
    <>
      {/* --------------------------------------------------------- header */}
      <DialogHeader className="border-b border-zinc-800 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-sm font-semibold text-zinc-100">
                {trade.symbol}
              </span>
              <SideBadge direction={trade.direction} />
              <span className="text-sm font-normal text-zinc-400">
                {trade.lots} {trade.lots === 1 ? 'contract' : 'contracts'}
              </span>
            </DialogTitle>
            <DialogDescription className="mt-1">
              {fmtDayLabel(trade.entryTime.slice(0, 10))} · {fmtTime(trade.entryTime)}
              {trade.durationMin > 0 ? ` → ${fmtTime(trade.exitTime)}` : ''} · {trade.id}
            </DialogDescription>
          </div>

          <div className="text-right">
            <p className={`text-2xl font-semibold tabular-nums ${pnlClass(trade.pnl)}`}>
              {fmtSignedCurrency(trade.pnl, true)}
            </p>
            <p className={`text-xs tabular-nums ${pnlClass(points)}`}>
              {fmtSignedPoints(points)} pts @ ${POINT_VALUE[trade.symbol]}/pt
            </p>
          </div>
        </div>
      </DialogHeader>

      <div className="max-h-[calc(88vh-92px)] space-y-6 overflow-y-auto p-5">
        {/* ------------------------------------------------- execution */}
        <section>
          <SectionLabel>Execution Details</SectionLabel>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
            <Cell label="Entry Price" value={fmtPrice(trade.entryPrice)} />
            <Cell label="Exit Price" value={fmtPrice(trade.exitPrice)} />
            <Cell label="Contracts" value={String(trade.lots)} />
            <Cell
              label="Duration"
              value={trade.durationMin > 0 ? fmtDuration(trade.durationMin) : '—'}
            />
            <Cell
              label="Gross P&L"
              value={fmtSignedCurrency(gross, true)}
              className={pnlClass(gross)}
            />
            <Cell
              label="Fees"
              value={`-$${trade.commission.toFixed(2)}`}
              className="text-zinc-300"
            />
            <Cell
              label="Net P&L"
              value={fmtSignedCurrency(trade.pnl, true)}
              className={pnlClass(trade.pnl)}
            />
            <Cell
              label="Net Points"
              value={fmtSignedPoints(points)}
              className={pnlClass(points)}
            />
          </dl>
        </section>

        {/* --------------------------------------- strategy & psychology */}
        <section>
          <SectionLabel>Strategy &amp; Psychology</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="mb-2 text-[11px] tracking-wider text-zinc-500 uppercase">
                Setups used
              </p>
              {trade.setups.length === 0 ? (
                <p className="text-xs text-zinc-600">None recorded</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {trade.setups.map((s) => (
                    <SetupTag key={s} label={s} />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="mb-2 text-[11px] tracking-wider text-zinc-500 uppercase">
                Mistakes made
              </p>
              {trade.mistakes.length === 0 ? (
                <p className="text-xs text-zinc-600">Clean execution — none flagged</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {trade.mistakes.map((m) => (
                    <MistakeTag key={m} label={m} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ---------------------------------------- media & attachments */}
        <section>
          <SectionLabel>
            Media &amp; Attachments
            <span className="ml-2 font-normal text-zinc-600 normal-case">
              {describeAttachments(trade.attachments)}
            </span>
          </SectionLabel>

          {trade.attachments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-10 text-center">
              <ImageIcon className="size-6 text-zinc-600" aria-hidden="true" />
              <p className="text-sm text-zinc-500">
                No screenshots or recordings attached to this trade
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {trade.attachments.map((url, i) => {
                const video = isVideoUrl(url)
                return (
                  <figure
                    key={url}
                    // A recording is the thing you actually watch, so it spans
                    // the full width instead of being cropped into a grid cell.
                    className={`overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60 ${
                      video ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <MediaAttachment
                      url={url}
                      label={`${video ? 'Recording' : 'Screenshot'} ${i + 1} for trade ${trade.id}`}
                      // The figure clips the corners; the band height is all
                      // that differs between a still and a recording.
                      className={video ? 'max-h-[420px]' : 'h-[180px]'}
                    />
                    <figcaption className="flex items-center gap-1.5 border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-500">
                      <MediaKindIcon url={url} className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {fileNameFromUrl(url, `attachment-${i + 1}`)}
                      </span>
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
      {children}
    </h3>
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
