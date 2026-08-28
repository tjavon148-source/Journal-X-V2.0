import { PaperclipIcon, PlayIcon } from 'lucide-react'

import type { Trade } from '../types'
import { GLASS } from './Card'
import { describeAttachments } from './MediaAttachment'
import { MistakeTag, SetupTag, SideBadge, pnlClass } from './TradeBits'
import { fmtPrice, fmtSignedCurrency, fmtSignedPoints, fmtTime, toISODate } from '../lib/format'
import { netPoints } from '../lib/instruments'
import { isVideoUrl } from '../lib/media'

/* ---------------------------------------------------------------- card */

export function TradeGalleryCard({ trade, onOpen }: { trade: Trade; onOpen: () => void }) {
  const points = netPoints(trade.entryPrice, trade.exitPrice, trade.direction)

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${GLASS} group flex flex-col overflow-hidden text-left transition hover:border-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-500/50 focus-visible:outline-none`}
    >
      <CardCover trade={trade} />

      <div className="flex flex-1 flex-col gap-3 p-3">
      {/* Header: identity and when */}
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-200">
          {trade.symbol}
        </span>
        <SideBadge direction={trade.direction} />
        <span className="ml-auto text-[11px] text-zinc-500 tabular-nums">
          {toISODate(new Date(trade.entryTime))} · {fmtTime(trade.entryTime)}
        </span>
      </div>

      {/* The number the card exists for */}
      <p className={`text-2xl font-semibold tracking-tight tabular-nums ${pnlClass(trade.pnl)}`}>
        {fmtSignedCurrency(trade.pnl)}
      </p>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <Chip label="Contracts" value={String(trade.lots)} />
        <Chip label="Net pts" value={fmtSignedPoints(points)} valueClass={pnlClass(points)} />
        <Chip
          label="Entry → Exit"
          value={`${fmtPrice(trade.entryPrice)} → ${fmtPrice(trade.exitPrice)}`}
        />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {trade.setups.map((s) => (
          <SetupTag key={s} label={s} />
        ))}
        {trade.mistakes.map((m) => (
          <MistakeTag key={m} label={m} />
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <PaperclipIcon className="size-3" aria-hidden="true" />
          {trade.attachments.length === 0
            ? 'No attachments'
            : describeAttachments(trade.attachments)}
        </span>
        <span className="text-zinc-600 transition group-hover:text-zinc-400">Inspect →</span>
      </div>
      </div>
    </button>
  )
}

/**
 * Notion-style cover. A trade with media shows its first attachment cropped to
 * a fixed band — a still for a screenshot, the poster frame for a recording —
 * and a trade without gets a gradient plate carrying the instrument as a
 * watermark, so every card in the grid keeps the same height either way.
 */
function CardCover({ trade }: { trade: Trade }) {
  const [cover] = trade.attachments

  if (cover) {
    const video = isVideoUrl(cover)
    return (
      <div className="relative h-36 overflow-hidden rounded-t-lg border-b border-zinc-800 bg-zinc-950/60">
        {video ? (
          // No controls: the whole card is a button, and a transport bar inside
          // it would swallow clicks meant to open the trade. Playback lives in
          // the inspector. `preload="metadata"` is enough for a poster frame.
          <video
            src={cover}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none h-36 w-full rounded-t-lg bg-black object-cover"
          />
        ) : (
          <img src={cover} alt="" loading="lazy" className="h-36 w-full rounded-t-lg object-cover" />
        )}

        {video ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-black/60 ring-1 ring-white/20 backdrop-blur-sm transition group-hover:bg-black/75 group-hover:ring-white/35">
              <PlayIcon className="size-4 translate-x-[1px] text-zinc-100" aria-hidden="true" />
            </span>
          </span>
        ) : null}

        {trade.attachments.length > 1 ? (
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-zinc-300 backdrop-blur-sm">
            <PaperclipIcon className="size-3" aria-hidden="true" />
            {trade.attachments.length}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-t-lg border-b border-zinc-800 bg-gradient-to-br from-zinc-800/70 via-zinc-900/80 to-black">
      <span
        aria-hidden="true"
        className="text-4xl font-bold tracking-tight text-white/[0.07] select-none"
      >
        {trade.symbol}
      </span>
      <span className="absolute right-2 bottom-2 text-[10px] text-zinc-600">No media</span>
    </div>
  )
}

function Chip({
  label,
  value,
  valueClass = 'text-zinc-200',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-950/60 px-2 py-1 ring-1 ring-zinc-800">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-medium tabular-nums ${valueClass}`}>{value}</span>
    </span>
  )
}
