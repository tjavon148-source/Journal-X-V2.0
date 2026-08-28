import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/**
 * `createClient` wants the bare project URL. Pasting the REST endpoint from the
 * dashboard (".../rest/v1/") is an easy mistake and produces 404s on every
 * request, so normalise it here rather than letting it fail at runtime.
 */
function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value.replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
}

/**
 * Secret keys bypass row-level security. A `VITE_` variable is compiled into
 * the client bundle and served to every visitor, so a secret key there is
 * readable by anyone who opens the site. supabase-js refuses to use one in the
 * browser; we detect it first to give an actionable message instead.
 */
const keyIsSecret = Boolean(rawKey?.startsWith('sb_secret_'))

const url = normalizeUrl(rawUrl)
const anonKey = keyIsSecret ? undefined : rawKey

export type SupabaseConfigProblem = 'missing' | 'secret-key'

export const configProblem: SupabaseConfigProblem | null = keyIsSecret
  ? 'secret-key'
  : url && anonKey
    ? null
    : 'missing'

export const isSupabaseConfigured = configProblem === null

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null

/** The bucket screenshots are uploaded to. */
export const ATTACHMENTS_BUCKET = 'trade-attachments'

/** Narrows the nullable client at a call site, with a useful message if absent. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  return supabase
}
