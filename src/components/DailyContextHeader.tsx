import { useMemo } from 'react'
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'

import type { DayStats } from '../types'
import { pnlClass } from './TradeBits'
import { fmtSignedCurrency } from '../lib/format'
import { NEG, POS } from '../theme'

/**
 * The execution facts for the journalled day, sitting above the write-up so a
 * reflection is always read next to what actually happened.
 */
export function DailyContextHeader({ stats }: { stats?: DayStats }) {
  if (!stats || stats.tradeCount === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
        <p className="text-sm text-zinc-500">No trades logged on this date.</p>
      </div>
    )
  }

  const wins = stats.trades.filter((t) => t.pnl > 0).length
  const winRate = (wins / stats.tradeCount) * 100

  return (
    <div className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:grid-cols-[repeat(3,minmax(0,1fr))_minmax(120px,1.4fr)] sm:items-center">
      <Metric
        label="Net Daily P&L"
        value={fmtSignedCurrency(stats.netPnl)}
        valueClass={pnlClass(stats.netPnl)}
        large
      />
      <Metric label="Total Trades" value={String(stats.tradeCount)} />
      <Metric
        label="Win Rate"
        value={`${winRate.toFixed(0)}%`}
        sub={`${wins}W / ${stats.tradeCount - wins}L`}
      />
      <DaySparkline stats={stats} />
    </div>
  )
}

function Metric({
  label,
  value,
  sub,
  valueClass = 'text-zinc-100',
  large = false,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
  large?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] tracking-wider text-zinc-500 uppercase">{label}</p>
      <p
        className={`mt-0.5 font-semibold tabular-nums ${large ? 'text-xl' : 'text-lg'} ${valueClass}`}
      >
        {value}
      </p>
      {sub ? <p className="text-[11px] text-zinc-600 tabular-nums">{sub}</p> : null}
    </div>
  )
}

/**
 * The day's equity curve, trade by trade. No axes or gridlines — at this size
 * the shape is the message, and the exact figures are already stated beside it.
 */
function DaySparkline({ stats }: { stats: DayStats }) {
  const data = useMemo(() => {
    let running = 0
    return [
      { i: 0, pnl: 0, label: 'Open' },
      ...stats.trades.map((t, i) => {
        running = Math.round((running + t.pnl) * 100) / 100
        return { i: i + 1, pnl: running, label: `After trade ${i + 1}` }
      }),
    ]
  }, [stats])

  const up = stats.netPnl >= 0
  const stroke = up ? POS : NEG
  const gradientId = `spark-${stats.date}`

  return (
    <div>
      <p className="text-[10px] tracking-wider text-zinc-500 uppercase">Equity Curve</p>
      <div className="mt-1 h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 3, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="3 3" />
            <Tooltip
              cursor={{ stroke: '#52525b', strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as { pnl: number; label: string }
                return (
                  <div className="rounded-lg border border-zinc-700/70 bg-zinc-950/95 px-2.5 py-1.5 shadow-xl">
                    <p className="text-[10px] text-zinc-400">{p.label}</p>
                    <p className={`text-xs font-semibold tabular-nums ${pnlClass(p.pnl)}`}>
                      {fmtSignedCurrency(p.pnl)}
                    </p>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={stroke}
              strokeWidth={1.75}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
