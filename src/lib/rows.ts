import type { DailyNote, Sentiment, Trade } from '../types'
import { fmtDayLabel } from './format'
import { netPoints } from './instruments'

/**
 * Row shapes exactly as they exist in Supabase, and the mapping to the
 * camelCase domain types the views use.
 *
 * The column names here were read off the live database rather than invented —
 * `asset`/`side`/`contracts`/`net_pnl`/`execution_time`, not the
 * symbol/direction/lots/pnl/entry_time the UI speaks internally. Keeping the
 * translation in one place means a column rename touches this file only.
 */

export interface TradeRow {
  id: string
  asset: 'NQ' | 'MNQ'
  side: 'Long' | 'Short'
  contracts: number
  entry_price: number
  exit_price: number
  /** Single timestamp: the table has no separate exit time. */
  execution_time: string
  /** Signed index points; NOT NULL in the database. */
  net_points: number
  net_pnl: number
  fees: number | null
  setups: string[] | null
  mistakes: string[] | null
  attachments: string[] | null
}

export interface DailyNoteRow {
  id: string
  date: string
  sentiment: string | null
  pre_market_plan: string | null
  execution_review: string | null
  lessons_learned: string | null
}

export interface TagRow {
  id: string
  name: string
  category: 'setup' | 'mistake'
}

export interface TagRecord {
  id: string
  label: string
  kind: 'setup' | 'mistake'
}

/** Postgres `numeric` arrives as a string over the wire in some drivers. */
const num = (value: number | string | null | undefined, fallback = 0): number => {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

export function tradeFromRow(row: TradeRow): Trade {
  const at = row.execution_time
  return {
    id: row.id,
    symbol: row.asset,
    direction: row.side,
    lots: num(row.contracts, 1),
    entryPrice: num(row.entry_price),
    exitPrice: num(row.exit_price),
    entryTime: at,
    // The table stores one timestamp per trade, so entry and exit coincide and
    // holding time is unknown. Views treat 0 as "not recorded" rather than
    // claiming an instant round trip.
    exitTime: at,
    durationMin: 0,
    pnl: num(row.net_pnl),
    commission: num(row.fees),
    setups: row.setups ?? [],
    mistakes: row.mistakes ?? [],
    attachments: row.attachments ?? [],
  }
}

export function noteFromRow(row: DailyNoteRow): DailyNote {
  const date = row.date.slice(0, 10)
  return {
    id: row.id,
    date,
    // No title column: derive a stable one from the date so the editor always
    // has a heading, rather than offering a field that silently discards input.
    title: `${fmtDayLabel(date)} — Session Journal`,
    sentiment: (row.sentiment ?? 'Trending') as Sentiment,
    preMarketPlan: row.pre_market_plan ?? '',
    executionReview: row.execution_review ?? '',
    lessonsLearned: row.lessons_learned ?? '',
  }
}

export function tagFromRow(row: TagRow): TagRecord {
  return { id: row.id, label: row.name, kind: row.category }
}

/** Insert payload for a new trade. `id` and `created_at` are the database's. */
export function tradeToInsert(trade: Omit<Trade, 'id'>) {
  return {
    asset: trade.symbol,
    side: trade.direction,
    contracts: trade.lots,
    entry_price: trade.entryPrice,
    exit_price: trade.exitPrice,
    execution_time: trade.entryTime,
    // Stored as well as derived: the column is NOT NULL, and writing the same
    // value the UI computes keeps the row self-consistent.
    net_points: netPoints(trade.entryPrice, trade.exitPrice, trade.direction),
    net_pnl: trade.pnl,
    fees: trade.commission,
    setups: trade.setups,
    mistakes: trade.mistakes,
    attachments: trade.attachments,
  }
}

/** Upsert payload for a daily note, keyed on `date`. */
export function noteToUpsert(note: DailyNote) {
  return {
    date: note.date,
    sentiment: note.sentiment,
    pre_market_plan: note.preMarketPlan,
    execution_review: note.executionReview,
    lessons_learned: note.lessonsLearned,
  }
}

/* ------------------------------------------------------------ recaps */

export interface VideoRecapRow {
  id: string
  kind: 'Daily' | 'Weekly'
  date: string
  end_date: string | null
  title: string
  notes: string | null
  /** Runtime read off the file at upload time; 0 when it could not be decoded. */
  duration_sec: number | null
  /** Public storage URL from the trade-attachments bucket. */
  video_url: string
}

export interface StoredRecap {
  id: string
  kind: 'Daily' | 'Weekly'
  date: string
  endDate?: string
  title: string
  notes: string
  durationSec: number
  videoUrl: string
}

export function recapFromRow(row: VideoRecapRow): StoredRecap {
  return {
    id: row.id,
    kind: row.kind,
    date: row.date.slice(0, 10),
    endDate: row.end_date ? row.end_date.slice(0, 10) : undefined,
    title: row.title,
    notes: row.notes ?? '',
    durationSec: num(row.duration_sec),
    videoUrl: row.video_url,
  }
}

/** Insert payload for an uploaded recap. `id` and `created_at` are the database's. */
export function recapToInsert(recap: Omit<StoredRecap, 'id'>) {
  return {
    kind: recap.kind,
    date: recap.date,
    end_date: recap.endDate ?? null,
    title: recap.title,
    notes: recap.notes,
    duration_sec: recap.durationSec,
    video_url: recap.videoUrl,
  }
}
