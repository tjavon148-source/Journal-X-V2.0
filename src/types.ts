import type { SENTIMENTS } from './lib/tags'

export type Instrument = 'NQ' | 'MNQ'
export type Direction = 'Long' | 'Short'

export interface Trade {
  id: string
  symbol: Instrument
  direction: Direction
  /** Contracts traded. */
  lots: number
  entryPrice: number
  exitPrice: number
  /** ISO timestamps. */
  entryTime: string
  exitTime: string
  /** Holding time in minutes. */
  durationMin: number
  /** Realized P&L in USD, net of the commission below. */
  pnl: number
  commission: number
  /** Price-action patterns the trade was taken on. */
  setups: string[]
  /** Execution errors flagged in review. */
  mistakes: string[]
  /** Public storage URLs of attached screenshots and screen recordings. */
  attachments: string[]
}

/** One calendar day's worth of trades, pre-aggregated. */
export interface DayStats {
  /** yyyy-mm-dd */
  date: string
  trades: Trade[]
  netPnl: number
  tradeCount: number
}

export type Sentiment = (typeof SENTIMENTS)[number]

/** A structured daily journal entry. */
export interface DailyNote {
  id: string
  /** yyyy-mm-dd */
  date: string
  title: string
  sentiment: Sentiment
  preMarketPlan: string
  executionReview: string
  lessonsLearned: string
}

export type RecapKind = 'Daily' | 'Weekly'

/**
 * Where a recap in the library came from.
 *
 * `derived` entries are summarised from the trades themselves and have no
 * recording behind them; `uploaded` entries are rows in `video_recaps` with a
 * real file in storage. The distinction drives whether the card offers playback.
 */
export type RecapSource = 'derived' | 'uploaded'

/** A recorded session review in the video library. */
export interface VideoRecap {
  id: string
  source: RecapSource
  /** Public storage URL of the recording; absent on derived recaps. */
  videoUrl?: string
  kind: RecapKind
  /** yyyy-mm-dd — the day, or the Monday of the week. */
  date: string
  /** yyyy-mm-dd end of range; weekly recaps only. */
  endDate?: string
  title: string
  /** Runtime in seconds. */
  durationSec: number
  notes: string
  tradeCount: number
  netPnl: number
  /** Running P&L through the period, used to draw the thumbnail. */
  curve: number[]
}
