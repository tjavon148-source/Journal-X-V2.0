import { SettingsIcon } from 'lucide-react'

export type View = 'dashboard' | 'calendar' | 'history' | 'recaps' | 'notes'

interface Props {
  view: View
  onViewChange: (view: View) => void
  onLogTrade: () => void
  onManageTags: () => void
}

const TABS: { id: View; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'history', label: 'History' },
  { id: 'recaps', label: 'Video Recaps' },
  { id: 'notes', label: 'Notes' },
]

export function Header({ view, onViewChange, onLogTrade, onManageTags }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-50 sm:text-base">
          Personal NQ/MNQ Journal
        </h1>

        <nav
          aria-label="View"
          className="flex overflow-x-auto rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-0.5 text-sm backdrop-blur-md"
        >
          {TABS.map((tab) => {
            const active = view === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onViewChange(tab.id)}
                className={`rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition ${
                  active
                    ? 'bg-zinc-700/80 text-zinc-50 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onManageTags}
            aria-label="Manage tags"
            title="Manage tags"
            className="flex size-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 backdrop-blur-md transition hover:border-zinc-700 hover:text-zinc-100"
          >
            <SettingsIcon className="size-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onLogTrade}
            className="rounded-lg bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white active:scale-[0.98]"
          >
            Log Trade
          </button>
        </div>
      </div>
    </header>
  )
}
