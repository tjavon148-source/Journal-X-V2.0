/**
 * Chart + P&L color tokens.
 *
 * Validated against the dark chart surface (#18181b) with the dataviz
 * six-check validator. See the note on POS/NEG below.
 */

/** Chart surface the marks sit on (card background, zinc-900). */
export const SURFACE = '#18181b'

/**
 * P&L polarity. Status good/critical.
 *
 * This pair sits in the CVD floor band (deutan dE 4.1), which is only legal
 * with secondary encoding — so every P&L value in the UI is rendered with an
 * explicit +/- sign, and the bar chart encodes sign by position relative to
 * the zero baseline. Never rely on the hue alone.
 */
export const POS = '#0ca30c'
export const NEG = '#d03b3b'

/** Categorical slots for trade direction. Not red/green: identity, not polarity. */
export const LONG = '#3987e5'
export const SHORT = '#d55181'

/** Chart chrome, stepped for the dark surface. */
export const GRID = '#2c2c2a'
export const AXIS = '#383835'
export const MUTED = '#898781'
