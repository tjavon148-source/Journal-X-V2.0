import { useMemo } from 'react'
import { ClockIcon, PlayIcon } from 'lucide-react'

import type { VideoRecap } from '../types'
import { NEG, POS } from '../theme'

/* ----------------------------------------------------------- thumbnail */

const W = 320
const H = 132

/**
 * The recap's poster frame is the period's own equity curve — the shape of the
 * session is the most informative thing a thumbnail could show, and it comes
 * from the same trades the recap describes rather than being decorative.
 */
export function RecapThumb({ recap, tall = false }: { recap: VideoRecap; tall?: boolean }) {
  const { path, area, zeroY } = useMemo(() => {
    const pts = recap.curve.length > 1 ? recap.curve : [0, recap.netPnl]
    const lo = Math.min(...pts, 0)
    const hi = Math.max(...pts, 0)
    const pad = (hi - lo) * 0.2 || 1
    const toY = (v: number) => H - ((v - lo + pad) / (hi - lo + pad * 2)) * H
    const toX = (i: number) => (i / (pts.length - 1)) * W

    const line = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    return {
      path: line.join(' '),
      area: `${line.join(' ')} L${W},${H} L0,${H} Z`,
      zeroY: toY(0),
    }
  }, [recap])

  const stroke = recap.netPnl >= 0 ? POS : NEG
  const gradientId = `recap-${recap.id}`

  return (
    <div
      className={`relative border-b border-zinc-800 bg-gradient-to-b from-zinc-900/60 to-black ${
        tall ? 'aspect-video' : 'h-[132px]'
      }`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        role="img"
        aria-label={`Equity curve for ${recap.title}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <line
          x1="0"
          x2={W}
          y1={zeroY}
          y2={zeroY}
          stroke="#71717a"
          strokeWidth="1"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth="1.75"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Play affordance */}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-black/60 ring-1 ring-white/20 backdrop-blur-sm transition group-hover:bg-black/75 group-hover:ring-white/35">
          <PlayIcon className="size-4 translate-x-[1px] text-zinc-100" aria-hidden="true" />
        </span>
      </span>

      <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] text-zinc-300 tabular-nums backdrop-blur-sm">
        <ClockIcon className="size-3" aria-hidden="true" />
        {fmtRuntime(recap.durationSec)}
      </span>
    </div>
  )
}

/** 754 -> "12:34" */
export function fmtRuntime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
