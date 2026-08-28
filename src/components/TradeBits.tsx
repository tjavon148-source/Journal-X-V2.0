import { PaperclipIcon } from 'lucide-react'
import type { Direction } from '../types'
import { LONG, SHORT } from '../theme'

/**
 * Long / Short identity badge. Blue and magenta, matching the dashboard's
 * direction donut — deliberately not the P&L green/red, so a side never reads
 * as a win or a loss.
 */
export function SideBadge({ direction }: { direction: Direction }) {
  const long = direction === 'Long'
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1"
      style={{
        color: long ? '#8bb8ef' : '#e08bac',
        backgroundColor: `${long ? LONG : SHORT}26`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--tw-ring-color' as any]: `${long ? LONG : SHORT}59`,
      }}
    >
      {direction}
    </span>
  )
}

export function SetupTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-zinc-700/50 px-1.5 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-600/50">
      {label}
    </span>
  )
}

/** Amber, not loss-red: a mistake is a caution flag, not a P&L sign. */
export function MistakeTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-[#fab219]/15 px-1.5 py-0.5 text-[11px] text-[#fab219] ring-1 ring-[#fab219]/35">
      {label}
    </span>
  )
}

export function AttachmentIndicator({ count }: { count: number }) {
  if (count === 0) return <span className="text-zinc-600">—</span>
  return (
    <span
      className="inline-flex items-center gap-1 text-zinc-400"
      title={`${count} chart ${count === 1 ? 'screenshot' : 'screenshots'}`}
    >
      <PaperclipIcon className="size-3" aria-hidden="true" />
      {count}
    </span>
  )
}

export const pnlClass = (value: number) =>
  value > 0 ? 'text-[#0ca30c]' : value < 0 ? 'text-[#d03b3b]' : 'text-zinc-400'
