import type { DayStats, Trade } from '../types'
import { toISODate } from './format'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const mean = (xs: number[]) => (xs.length === 0 ? 0 : sum(xs) / xs.length)

/** Group trades by their entry date, ascending. Days with no trades are absent. */
export function groupByDay(trades: Trade[]): DayStats[] {
  const byDate = new Map<string, Trade[]>()
  for (const t of trades) {
    const key = toISODate(new Date(t.entryTime))
    const bucket = byDate.get(key)
    if (bucket) bucket.push(t)
    else byDate.set(key, [t])
  }

  return [...byDate.entries()]
    .map(([date, dayTrades]) => ({
      date,
      trades: dayTrades,
      netPnl: round2(sum(dayTrades.map((t) => t.pnl))),
      tradeCount: dayTrades.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

const round2 = (n: number) => Math.round(n * 100) / 100

export interface Metrics {
  totalTrades: number
  totalLots: number
  netPnl: number
  avgTradeDuration: number
  avgWinDuration: number
  avgLossDuration: number
  avgWin: number
  avgLoss: number
  winCount: number
  lossCount: number
  /** Percentage of trades closed green, 0-100. */
  winRate: number
  /**
   * Average winner divided by average loser, as the `x` in "1 : x".
   * null when there are no losers to divide by.
   */
  avgRR: number | null
  longCount: number
  shortCount: number
  longPct: number
  shortPct: number
  bestTrade: Trade | null
  worstTrade: Trade | null
  mostActiveDay: DayStats | null
  mostProfitableDay: DayStats | null
  leastProfitableDay: DayStats | null
  days: DayStats[]
  /** Running net P&L by day, for the cumulative area chart. */
  cumulative: { date: string; cumulative: number }[]
}

export function computeMetrics(trades: Trade[]): Metrics {
  const days = groupByDay(trades)
  const wins = trades.filter((t) => t.pnl > 0)
  const losses = trades.filter((t) => t.pnl < 0)
  const longs = trades.filter((t) => t.direction === 'Long')

  let running = 0
  const cumulative = days.map((d) => {
    running = round2(running + d.netPnl)
    return { date: d.date, cumulative: running }
  })

  const longCount = longs.length
  const shortCount = trades.length - longCount

  const avgWin = round2(mean(wins.map((t) => t.pnl)))
  const avgLoss = round2(mean(losses.map((t) => t.pnl)))

  return {
    totalTrades: trades.length,
    totalLots: sum(trades.map((t) => t.lots)),
    netPnl: round2(sum(trades.map((t) => t.pnl))),
    avgTradeDuration: mean(trades.map((t) => t.durationMin)),
    avgWinDuration: mean(wins.map((t) => t.durationMin)),
    avgLossDuration: mean(losses.map((t) => t.durationMin)),
    avgWin,
    avgLoss,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    // Guard the divide: a sample with no losing trades has no meaningful ratio.
    avgRR: avgLoss === 0 ? null : Math.abs(avgWin / avgLoss),
    longCount,
    shortCount,
    longPct: trades.length ? (longCount / trades.length) * 100 : 0,
    shortPct: trades.length ? (shortCount / trades.length) * 100 : 0,
    bestTrade: maxBy(trades, (t) => t.pnl),
    worstTrade: minBy(trades, (t) => t.pnl),
    mostActiveDay: maxBy(days, (d) => d.tradeCount),
    mostProfitableDay: maxBy(days, (d) => d.netPnl),
    leastProfitableDay: minBy(days, (d) => d.netPnl),
    days,
    cumulative,
  }
}

function maxBy<T>(items: T[], score: (item: T) => number): T | null {
  if (items.length === 0) return null
  return items.reduce((best, it) => (score(it) > score(best) ? it : best))
}

function minBy<T>(items: T[], score: (item: T) => number): T | null {
  if (items.length === 0) return null
  return items.reduce((worst, it) => (score(it) < score(worst) ? it : worst))
}

/**
 * Where zero falls as a 0-1 fraction of a chart's y-range, for splitting an
 * area chart's gradient at the zero line. 0 = all below zero, 1 = all above.
 */
export function zeroOffset(values: number[]): number {
  if (values.length === 0) return 1
  const max = Math.max(...values)
  const min = Math.min(...values)
  if (max <= 0) return 0
  if (min >= 0) return 1
  return max / (max - min)
}

/** A month's days as calendar weeks (Sun-Sat), padded with nulls outside the month. */
export function buildMonthGrid(month: Date): (Date | null)[][] {
  const year = month.getFullYear()
  const m = month.getMonth()
  const first = new Date(year, m, 1)
  const daysInMonth = new Date(year, m + 1, 0).getDate()

  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
