import { useId, useMemo, useState } from 'react'
import { SearchIcon } from 'lucide-react'

import type { Instrument, Trade } from '../types'
import { GLASS } from '../components/Card'
import { pnlClass } from '../components/TradeBits'
import { TradeDetailModal } from '../components/TradeDetailModal'
import { TradeGalleryCard } from '../components/TradeGalleryCard'
import { fmtSignedCurrency } from '../lib/format'
import type { TagVocabulary } from '../lib/tags'

type AssetFilter = 'All' | Instrument
type SideFilter = 'All' | 'Long' | 'Short'

const ASSETS: AssetFilter[] = ['All', 'NQ', 'MNQ']
const SIDES: SideFilter[] = ['All', 'Long', 'Short']

const PAGE = 36

export function History({
  trades,
  vocabulary,
}: {
  trades: Trade[]
  vocabulary: TagVocabulary
}) {
  const suggestionsId = useId()
  const [asset, setAsset] = useState<AssetFilter>('All')
  const [side, setSide] = useState<SideFilter>('All')
  const [tagQuery, setTagQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [inspecting, setInspecting] = useState<Trade | null>(null)

  const matches = useMemo(() => {
    const q = tagQuery.trim().toLowerCase()
    return trades
      .filter((t) => asset === 'All' || t.symbol === asset)
      .filter((t) => side === 'All' || t.direction === side)
      .filter((t) =>
        q === ''
          ? true
          : [...t.setups, ...t.mistakes].some((tag) => tag.toLowerCase().includes(q)),
      )
      .slice()
      .sort((a, b) => b.entryTime.localeCompare(a.entryTime))
  }, [trades, asset, side, tagQuery])

  const netPnl = matches.reduce((a, t) => a + t.pnl, 0)
  const visible = matches.slice(0, limit)

  // Changing a filter should show the top of the new result set, not page 3 of it.
  const resetAnd = <T,>(set: (v: T) => void) => (value: T) => {
    set(value)
    setLimit(PAGE)
  }

  return (
    <div className="space-y-3">
      {/* ------------------------------------------------------- toolbar */}
      <div className={`${GLASS} flex flex-wrap items-end gap-4 p-3`}>
        <FilterGroup label="Asset" options={ASSETS} value={asset} onChange={resetAnd(setAsset)} />
        <FilterGroup label="Direction" options={SIDES} value={side} onChange={resetAnd(setSide)} />

        <div className="min-w-[200px] flex-1">
          <p className="mb-1.5 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
            Tag search
          </p>
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={tagQuery}
              onChange={(e) => {
                setTagQuery(e.target.value)
                setLimit(PAGE)
              }}
              placeholder="Setup or mistake, e.g. ORB"
              aria-label="Search setup and mistake tags"
              list={suggestionsId}
              className="h-8 w-full rounded-lg border border-zinc-700/70 bg-zinc-950/50 pr-2.5 pl-8 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-500/30 focus-visible:outline-none"
            />
            {/* Suggestions come from the live vocabulary, so a tag added in the
                Tag Manager is immediately filterable here. */}
            <datalist id={suggestionsId}>
              {[...vocabulary.setups, ...vocabulary.mistakes].map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="ml-auto text-right">
          <p className="text-[11px] tracking-wider text-zinc-400 uppercase">
            {matches.length} of {trades.length}
          </p>
          <p className={`text-sm font-semibold tabular-nums ${pnlClass(netPnl)}`}>
            {matches.length ? fmtSignedCurrency(netPnl) : '—'}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------- gallery */}
      {matches.length === 0 ? (
        <div className={`${GLASS} px-3 py-16 text-center text-sm text-zinc-500`}>
          No trades match these filters.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {visible.map((trade) => (
              <TradeGalleryCard
                key={trade.id}
                trade={trade}
                onOpen={() => setInspecting(trade)}
              />
            ))}
          </div>

          {visible.length < matches.length ? (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE)}
                className={`${GLASS} px-4 py-2 text-sm font-medium text-zinc-300 transition hover:text-zinc-100`}
              >
                Show {Math.min(PAGE, matches.length - visible.length)} more
                <span className="ml-1.5 text-zinc-500">
                  ({visible.length} of {matches.length})
                </span>
              </button>
            </div>
          ) : null}
        </>
      )}

      <TradeDetailModal trade={inspecting} onClose={() => setInspecting(null)} />
    </div>
  )
}

/* -------------------------------------------------------------- filters */

interface FilterGroupProps<T extends string> {
  label: string
  options: T[]
  value: T
  onChange: (next: T) => void
}

function FilterGroup<T extends string>({ label, options, value, onChange }: FilterGroupProps<T>) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
        {label}
      </p>
      <div
        role="group"
        aria-label={label}
        className="flex rounded-lg border border-zinc-700/70 bg-zinc-950/50 p-0.5"
      >
        {options.map((option) => {
          const active = option === value
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                active ? 'bg-zinc-700/80 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
