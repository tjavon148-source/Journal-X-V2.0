import type { ReactNode } from 'react'

/**
 * The shared glass surface. Everything that sits over the cosmic backdrop uses
 * this treatment so the starfield reads through consistently without ever
 * competing with the numbers on top of it.
 */
export const GLASS =
  'rounded-xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-md'

interface CardProps {
  title: string
  /** Optional right-aligned annotation in the card header. */
  meta?: ReactNode
  children: ReactNode
  className?: string
}

export function Card({ title, meta, children, className = '' }: CardProps) {
  return (
    <section className={`${GLASS} flex flex-col p-4 ${className}`}>
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
          {title}
        </h3>
        {meta ? <span className="text-[11px] text-zinc-500">{meta}</span> : null}
      </header>
      <div className="mt-3 flex flex-1 flex-col justify-center">{children}</div>
    </section>
  )
}

type Tone = 'positive' | 'negative' | 'neutral'

interface StatProps {
  value: string
  sub?: ReactNode
  tone?: Tone
}

const TONE_CLASS: Record<Tone, string> = {
  positive: 'text-[#0ca30c]',
  negative: 'text-[#d03b3b]',
  neutral: 'text-zinc-50',
}

/** The headline number inside a Card, with optional supporting line. */
export function Stat({ value, sub, tone = 'neutral' }: StatProps) {
  return (
    <div>
      <p
        className={`text-2xl font-semibold tracking-tight tabular-nums xl:text-[26px] ${TONE_CLASS[tone]}`}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  )
}

/** Tone from a signed number, for P&L values. */
export const toneOf = (value: number): Tone =>
  value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
