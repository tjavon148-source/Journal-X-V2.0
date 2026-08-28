import type { TagRecord } from './rows'

/**
 * Default tag vocabulary. These seed the editable lists the Tag Manager owns —
 * once the app is running, the live vocabulary lives in App state, and every
 * consumer (Log Trade form, History filters) reads that rather than these
 * constants.
 */

export const DEFAULT_SETUPS = [
  'Break & Retest',
  'Liquidity Sweep',
  'ORB',
  'Trendline Bounce',
] as const

/** Mistakes and emotions share one list — both answer "why did this happen?" */
export const DEFAULT_MISTAKES = [
  'FOMO',
  'Revenge Trade',
  'Hesitation',
  'Moved Stop',
  'Chasing',
] as const

export const SENTIMENTS = [
  'Trending',
  'Ranging',
  'High Volatility',
  'Choppy',
  'News Driven',
] as const

/** The editable vocabulary, derived from the `tags` table. */
export interface TagVocabulary {
  setups: string[]
  mistakes: string[]
}

export const DEFAULT_VOCABULARY: TagVocabulary = {
  setups: [...DEFAULT_SETUPS],
  mistakes: [...DEFAULT_MISTAKES],
}


/** Groups tag records into the two label lists the form and filters consume. */
export function vocabularyFromTags(tags: TagRecord[]): TagVocabulary {
  if (tags.length === 0) return DEFAULT_VOCABULARY
  return {
    setups: tags.filter((t) => t.kind === 'setup').map((t) => t.label),
    mistakes: tags.filter((t) => t.kind === 'mistake').map((t) => t.label),
  }
}
