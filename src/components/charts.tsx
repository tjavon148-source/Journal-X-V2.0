import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReactNode } from 'react'
import { AXIS, GRID, LONG, MUTED, NEG, POS, SHORT } from '../theme'
import { fmtNumber, fmtShortDate, fmtSignedCurrency } from '../lib/format'
import { zeroOffset } from '../lib/metrics'

const axisProps = {
  stroke: AXIS,
  tick: { fill: MUTED, fontSize: 11 },
  tickLine: false,
} as const

const compactUsd = (v: number) =>
  Math.abs(v) >= 1000 ? `${v < 0 ? '-' : ''}$${Math.abs(v / 1000).toFixed(1)}k` : `$${v}`

function TooltipShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-700/70 bg-zinc-950/95 px-3 py-2 shadow-xl">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{children}</div>
    </div>
  )
}

const signClass = (v: number) => (v >= 0 ? 'text-[#0ca30c]' : 'text-[#d03b3b]')

/* ---------------------------------------------------------------- cumulative */

interface CumulativePoint {
  date: string
  cumulative: number
}

export function CumulativePnlChart({ data }: { data: CumulativePoint[] }) {
  // Split both the fill and the stroke at the zero line, so the curve itself
  // turns red once cumulative P&L goes underwater.
  const offset = zeroOffset(data.map((d) => d.cumulative))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset={offset} stopColor={POS} stopOpacity={0.45} />
            <stop offset={offset} stopColor={POS} stopOpacity={0.02} />
            <stop offset={offset} stopColor={NEG} stopOpacity={0.02} />
            <stop offset={1} stopColor={NEG} stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="cumStroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset={offset} stopColor={POS} />
            <stop offset={offset} stopColor={NEG} />
          </linearGradient>
        </defs>

        <XAxis
          {...axisProps}
          dataKey="date"
          tickFormatter={fmtShortDate}
          minTickGap={28}
          axisLine={{ stroke: AXIS }}
        />
        <YAxis {...axisProps} tickFormatter={compactUsd} axisLine={false} width={52} />
        <Tooltip
          cursor={{ stroke: GRID, strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as CumulativePoint
            return (
              <TooltipShell label={fmtShortDate(p.date)}>
                <span className={signClass(p.cumulative)}>
                  {fmtSignedCurrency(p.cumulative)}
                </span>
                <span className="ml-1.5 text-[11px] font-normal text-zinc-500">cumulative</span>
              </TooltipShell>
            )
          }}
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke="url(#cumStroke)"
          strokeWidth={2}
          fill="url(#cumFill)"
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#18181b' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ----------------------------------------------------------------- net daily */

interface DailyPoint {
  date: string
  netPnl: number
  tradeCount: number
}

interface BarShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: DailyPoint
}

/**
 * Rounds the *data* end of the bar and leaves the baseline end square, so the
 * corner radius reads as the tip of the value rather than a floating pill.
 */
function PnlBar({ x = 0, y = 0, width = 0, height = 0, payload }: BarShapeProps) {
  const up = (payload?.netPnl ?? 0) >= 0
  return (
    <Rectangle
      x={x}
      y={y}
      width={width}
      height={height}
      fill={up ? POS : NEG}
      radius={up ? [3, 3, 0, 0] : [0, 0, 3, 3]}
    />
  )
}

export function DailyPnlChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <XAxis
          {...axisProps}
          dataKey="date"
          tickFormatter={fmtShortDate}
          minTickGap={28}
          axisLine={{ stroke: AXIS }}
        />
        <YAxis {...axisProps} tickFormatter={compactUsd} axisLine={false} width={52} />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as DailyPoint
            return (
              <TooltipShell label={fmtShortDate(p.date)}>
                <span className={signClass(p.netPnl)}>{fmtSignedCurrency(p.netPnl)}</span>
                <span className="ml-1.5 text-[11px] font-normal text-zinc-500">
                  {p.tradeCount} {p.tradeCount === 1 ? 'trade' : 'trades'}
                </span>
              </TooltipShell>
            )
          }}
        />
        <Bar dataKey="netPnl" maxBarSize={14} shape={<PnlBar />} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ---------------------------------------------------------------- direction */

interface DirectionDatum {
  name: 'Long' | 'Short'
  value: number
  pct: number
}

const DIRECTION_COLOR: Record<DirectionDatum['name'], string> = { Long: LONG, Short: SHORT }

export function DirectionDonut({ data }: { data: DirectionDatum[] }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-[112px] w-[112px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={34}
              outerRadius={52}
              paddingAngle={3}
              stroke="#18181b"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={DIRECTION_COLOR[d.name]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as DirectionDatum
                return (
                  <TooltipShell label={p.name}>
                    {p.pct.toFixed(1)}%
                    <span className="ml-1.5 text-[11px] font-normal text-zinc-500">
                      {fmtNumber(p.value)} trades
                    </span>
                  </TooltipShell>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend + direct labels: identity is never carried by color alone. */}
      <ul className="min-w-0 space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: DIRECTION_COLOR[d.name] }}
            />
            <span className="text-zinc-400">{d.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-zinc-100">
              {d.pct.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

