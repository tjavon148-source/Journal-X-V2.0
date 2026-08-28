import type { DailyNote, DayStats, Trade, VideoRecap } from '../types'
import type { StoredRecap } from './rows'
import { groupByDay } from './metrics'
import { fmtDayLabel, fmtShortDate, parseISODate, toISODate } from './format'

/**
 * The recap library has two kinds of entry, and they are not interchangeable.
 *
 * *Derived* entries summarise a real day or week of trades; their notes come
 * from that day's journal entry when one exists rather than being invented, and
 * their runtime is an estimate from trade count. Nothing about them claims a
 * recording exists.
 *
 * *Uploaded* entries are rows in `video_recaps` with a real file in the
 * trade-attachments bucket. Their runtime is read off the file. Where an upload
 * covers the same period as a derived entry it replaces it — the recording is
 * the better artefact for that session, and two cards for one day is a lie
 * about how much review exists.
 *
 * Either way the P&L, trade count and equity curve are computed here from the
 * trades in the period, never stored, so they cannot go stale.
 */

/** Rough runtime for a review: a base plus time per trade walked through. */
const estimateRuntime = (tradeCount: number, base: number) =>
  base + tradeCount * 95

/** The Monday on or before a date. */
function weekStart(isoDate: string): Date {
  const d = parseISODate(isoDate)
  const offset = (d.getDay() + 6) % 7 // Mon = 0
  d.setDate(d.getDate() - offset)
  return d
}

/** Running P&L through a set of days, trade by trade, for the thumbnail path. */
function buildCurve(days: DayStats[]): number[] {
  const curve: number[] = [0]
  let running = 0
  for (const day of days) {
    for (const trade of day.trades) {
      running += trade.pnl
      curve.push(Math.round(running * 100) / 100)
    }
  }
  return curve
}

export function buildRecaps(
  trades: Trade[],
  notes: DailyNote[],
  uploaded: StoredRecap[] = [],
): VideoRecap[] {
  const days = groupByDay(trades)

  // An upload stands on its own: a recap recorded before the first trade was
  // logged, or for a day with no fills, still belongs in the library.
  if (trades.length === 0) return uploaded.map((recap) => fromUpload(recap, days)).sort(byNewest)

  const noteByDate = new Map(notes.map((n) => [n.date, n]))
  const recaps: VideoRecap[] = []

  // Daily recaps for the most recent sessions — enough to fill the library
  // without one entry per session across the whole history.
  const recent = days.slice(-24).reverse()
  recent.forEach((day, i) => {
    const note = noteByDate.get(day.date)
    recaps.push({
      id: `R-D-${day.date}`,
      source: 'derived',
      kind: 'Daily',
      date: day.date,
      title: `${fmtDayLabel(day.date)} — Session Recap`,
      durationSec: estimateRuntime(day.tradeCount, 240),
      notes:
        note?.executionReview?.trim() ||
        note?.lessonsLearned?.trim() ||
        'No journal entry written for this session yet.',
      tradeCount: day.tradeCount,
      netPnl: day.netPnl,
      curve: buildCurve([day]),
    })
    void i
  })

  // Weekly recaps over the same span, bucketed Mon-Fri.
  const buckets = new Map<string, DayStats[]>()
  for (const day of days) {
    const key = toISODate(weekStart(day.date))
    const bucket = buckets.get(key)
    if (bucket) bucket.push(day)
    else buckets.set(key, [day])
  }

  const weeks = [...buckets.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10)
  weeks.forEach(([start, weekDays]) => {
    const net = weekDays.reduce((a, d) => a + d.netPnl, 0)
    const tradeCount = weekDays.reduce((a, d) => a + d.tradeCount, 0)
    recaps.push({
      id: `R-W-${start}`,
      source: 'derived',
      kind: 'Weekly',
      date: start,
      endDate: weekDays[weekDays.length - 1].date,
      title: `Week of ${fmtShortDate(start)} — Weekly Review`,
      durationSec: estimateRuntime(tradeCount, 600),
      notes: `${weekDays.length} ${weekDays.length === 1 ? 'session' : 'sessions'}, ${tradeCount} ${
        tradeCount === 1 ? 'trade' : 'trades'
      }. Reviewed side by side to compare setups and holding time across the week.`,
      tradeCount,
      netPnl: Math.round(net * 100) / 100,
      curve: buildCurve(weekDays),
    })
  })

  // Uploads replace the derived entry for the same period, then join the rest.
  const covered = new Set(uploaded.map((r) => `${r.kind}:${r.date}`))
  const merged = recaps.filter((r) => !covered.has(`${r.kind}:${r.date}`))
  for (const recap of uploaded) merged.push(fromUpload(recap, days))

  return merged.sort(byNewest)
}

/** Newest first, weeklies ahead of the days they cover. */
function byNewest(a: VideoRecap, b: VideoRecap): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date)
  if (a.kind !== b.kind) return a.kind === 'Weekly' ? -1 : 1
  return 0
}

/** Turns a stored upload into a library entry, costed against the real trades. */
function fromUpload(recap: StoredRecap, days: DayStats[]): VideoRecap {
  const last = recap.endDate ?? recap.date
  const covered = days.filter((d) => d.date >= recap.date && d.date <= last)
  const tradeCount = covered.reduce((a, d) => a + d.tradeCount, 0)
  const netPnl = covered.reduce((a, d) => a + d.netPnl, 0)

  return {
    id: recap.id,
    source: 'uploaded',
    videoUrl: recap.videoUrl,
    kind: recap.kind,
    date: recap.date,
    endDate: recap.endDate,
    title: recap.title,
    durationSec: recap.durationSec,
    notes: recap.notes || 'No notes were written for this recording.',
    tradeCount,
    netPnl: Math.round(netPnl * 100) / 100,
    curve: buildCurve(covered),
  }
}
