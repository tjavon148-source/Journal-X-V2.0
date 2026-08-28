import type { Instrument } from '../types'

/** Dollar value of one index point, per contract. */
export const POINT_VALUE: Record<Instrument, number> = { NQ: 20, MNQ: 2 }

/** Typical round-turn commission per contract, used to seed the fees field. */
export const COMMISSION: Record<Instrument, number> = { NQ: 4.28, MNQ: 1.54 }

export const INSTRUMENTS: Instrument[] = ['NQ', 'MNQ']

/**
 * Net points on a trade, signed by direction: a short that exits lower wins.
 */
export function netPoints(entry: number, exit: number, direction: 'Long' | 'Short'): number {
  return (exit - entry) * (direction === 'Long' ? 1 : -1)
}

/** Net P&L in USD for a filled trade, after fees. */
export function netPnl(
  points: number,
  contracts: number,
  instrument: Instrument,
  fees: number,
): number {
  return points * contracts * POINT_VALUE[instrument] - fees
}
