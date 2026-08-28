import { useMemo, useState } from 'react'
import type { DayStats } from '../types'
import { buildMonthGrid } from '../lib/metrics'
import { fmtSignedCurrency, toISODate } from '../lib/format'
import { GLASS } from '../components/Card'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  days: DayStats[]
  initialMonth: Date
}

export function CalendarView({ days, initialMonth }: Props) {
  const [month, setMonth] = useState(initialMonth)

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
  const weeks = useMemo(() => buildMonthGrid(month), [month])

  const monthDays = weeks
    .flat()
    .filter((d): d is Date => d !== null)
    .map((d) => byDate.get(toISODate(d)))
    .filter((d): d is DayStats => d !== undefined)

  const monthNet = monthDays.reduce((a, d) => a + d.netPnl, 0)
  const monthTrades = monthDays.reduce((a, d) => a + d.tradeCount, 0)

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  return (
    <section className={`${GLASS} p-4`}>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <NavButton label="Previous month" onClick={() => shiftMonth(-1)}>
            ‹
          </NavButton>
          <h2 className="min-w-[168px] text-center text-base font-semibold text-zinc-50">
            {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <NavButton label="Next month" onClick={() => shiftMonth(1)}>
            ›
          </NavButton>
        </div>

        <div className="ml-auto flex items-baseline gap-2 text-sm">
          <span className="text-zinc-500">Month net</span>
          <span className={`font-semibold tabular-nums ${pnlClass(monthNet)}`}>
            {monthDays.length ? fmtSignedCurrency(monthNet) : '—'}
          </span>
          <span className="text-xs text-zinc-600">
            {monthTrades} {monthTrades === 1 ? 'trade' : 'trades'}
          </span>
        </div>
      </header>

      {/* 7 day columns + a weekly totals column. Below ~820px the grid keeps its
            shape and scrolls sideways rather than crushing the day cells. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="grid min-w-[780px] grid-cols-[repeat(7,minmax(0,1fr))_minmax(96px,0.9fr)] gap-1.5">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="pb-1 text-center text-[11px] font-medium tracking-wider text-zinc-500 uppercase"
            >
              {d}
            </div>
          ))}
          <div className="pb-1 text-center text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
            Weekly
          </div>

          {weeks.map((week, wi) => {
            const weekDays = week
              .filter((d): d is Date => d !== null)
              .map((d) => byDate.get(toISODate(d)))
              .filter((d): d is DayStats => d !== undefined)

            const weekNet = weekDays.reduce((a, d) => a + d.netPnl, 0)
            const weekTrades = weekDays.reduce((a, d) => a + d.tradeCount, 0)

            return (
              <WeekRow
                key={wi}
                week={week}
                byDate={byDate}
                weekIndex={wi}
                weekNet={weekNet}
                weekTrades={weekTrades}
                hasTrades={weekDays.length > 0}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

interface WeekRowProps {
  week: (Date | null)[]
  byDate: Map<string, DayStats>
  weekIndex: number
  weekNet: number
  weekTrades: number
  hasTrades: boolean
}

function WeekRow({ week, byDate, weekIndex, weekNet, weekTrades, hasTrades }: WeekRowProps) {
  return (
    <>
      {week.map((date, di) => {
        if (!date) return <div key={`pad-${weekIndex}-${di}`} className="min-h-[86px]" />
        const stats = byDate.get(toISODate(date))
        return <DayCell key={toISODate(date)} date={date} stats={stats} />
      })}

      <div
        className={`flex min-h-[86px] flex-col justify-center rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2 py-2 text-center ${
          hasTrades ? '' : 'opacity-40'
        }`}
      >
        <p className="text-[10px] tracking-wider text-zinc-500 uppercase">Week {weekIndex + 1}</p>
        <p className={`mt-1 text-sm font-semibold tabular-nums ${pnlClass(weekNet)}`}>
          {hasTrades ? fmtSignedCurrency(weekNet) : '—'}
        </p>
        {hasTrades ? (
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {weekTrades} {weekTrades === 1 ? 'trade' : 'trades'}
          </p>
        ) : null}
      </div>
    </>
  )
}

function DayCell({ date, stats }: { date: Date; stats?: DayStats }) {
  const active = stats !== undefined && stats.tradeCount > 0

  // Faint polarity tint on traded days; untraded days stay on the base surface.
  const tint = !active
    ? 'bg-zinc-950/30 border-zinc-800/60'
    : stats.netPnl >= 0
      ? 'bg-green-950/30 border-[#0ca30c]/25'
      : 'bg-red-950/30 border-[#d03b3b]/25'

  return (
    <div className={`relative flex min-h-[86px] flex-col rounded-lg border p-2 ${tint}`}>
      <span className="absolute top-1.5 left-2 text-[11px] font-medium text-zinc-500 tabular-nums">
        {date.getDate()}
      </span>

      {active ? (
        <div className="flex flex-1 flex-col items-center justify-center pt-3">
          <p className={`text-sm font-semibold tabular-nums ${pnlClass(stats.netPnl)}`}>
            {fmtSignedCurrency(stats.netPnl)}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {stats.tradeCount} {stats.tradeCount === 1 ? 'trade' : 'trades'}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/70 text-lg text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-100"
    >
      {children}
    </button>
  )
}

const pnlClass = (v: number) =>
  v > 0 ? 'text-[#0ca30c]' : v < 0 ? 'text-[#d03b3b]' : 'text-zinc-400'
