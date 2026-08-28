import { useMemo, useState } from 'react'
import { AlertTriangleIcon, DatabaseIcon, LoaderIcon, RefreshCwIcon } from 'lucide-react'

import { CosmicBackground } from './components/CosmicBackground'
import { GLASS } from './components/Card'
import { Header, type View } from './components/Header'
import { LogTradeModal } from './components/LogTradeModal'
import { TagManagerDialog } from './components/TagManagerDialog'
import { Dashboard } from './views/Dashboard'
import { CalendarView } from './views/CalendarView'
import { History } from './views/History'
import { VideoRecaps } from './views/VideoRecaps'
import { Notes } from './views/Notes'
import { useJournalData } from './hooks/useJournalData'
import { configProblem } from './lib/supabase'
import { computeMetrics } from './lib/metrics'
import { buildRecaps } from './lib/recaps'

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [modalOpen, setModalOpen] = useState(false)
  const [tagManagerOpen, setTagManagerOpen] = useState(false)

  const journal = useJournalData()
  const { trades, notes, status, uploadedRecaps, vocabulary } = journal

  const metrics = useMemo(() => computeMetrics(trades), [trades])
  const recaps = useMemo(
    () => buildRecaps(trades, notes, uploadedRecaps),
    [trades, notes, uploadedRecaps],
  )

  // The calendar opens on the most recent month that actually has trades.
  const initialMonth = useMemo(() => {
    const latest = metrics.days.at(-1)?.date
    if (!latest) return new Date()
    const [y, m] = latest.split('-').map(Number)
    return new Date(y, m - 1, 1)
  }, [metrics.days])

  const canPersist = status !== 'unconfigured'

  return (
    <div className="min-h-full">
      <CosmicBackground />

      <Header
        view={view}
        onViewChange={setView}
        onLogTrade={() => setModalOpen(true)}
        onManageTags={() => setTagManagerOpen(true)}
      />

      <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
        {status === 'unconfigured' ? (
          <Notice
            icon={
              configProblem === 'secret-key' ? (
                <AlertTriangleIcon className="size-5 text-[#d03b3b]" aria-hidden="true" />
              ) : (
                <DatabaseIcon className="size-5 text-zinc-400" aria-hidden="true" />
              )
            }
            title={
              configProblem === 'secret-key'
                ? 'That is a secret key — do not use it here'
                : 'Supabase is not configured'
            }
            body={
              configProblem === 'secret-key'
                ? 'VITE_SUPABASE_ANON_KEY holds an sb_secret_… key. Anything in a VITE_ variable is compiled into the JavaScript sent to every visitor, and a secret key bypasses row-level security. Rotate that key in the Supabase dashboard and put the publishable (sb_publishable_…) key here instead.'
                : 'Copy .env.example to .env.local, add your project URL and publishable key, then restart the dev server. The schema this app expects is in supabase/schema.sql.'
            }
          />
        ) : status === 'loading' ? (
          <Notice
            icon={<LoaderIcon className="size-5 animate-spin text-zinc-400" aria-hidden="true" />}
            title="Loading your journal…"
            body="Fetching trades and daily notes from Supabase."
          />
        ) : status === 'error' ? (
          <Notice
            icon={<AlertTriangleIcon className="size-5 text-[#d03b3b]" aria-hidden="true" />}
            title="Could not load the journal"
            body={journal.error ?? 'Unknown error.'}
            action={
              <button
                type="button"
                onClick={() => void journal.refresh()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-white"
              >
                <RefreshCwIcon className="size-3.5" aria-hidden="true" />
                Retry
              </button>
            }
          />
        ) : (
          <>
            {view === 'dashboard' ? <Dashboard metrics={metrics} /> : null}
            {view === 'calendar' ? (
              <CalendarView days={metrics.days} initialMonth={initialMonth} />
            ) : null}
            {view === 'history' ? <History trades={trades} vocabulary={vocabulary} /> : null}
            {view === 'recaps' ? (
              <VideoRecaps
                recaps={recaps}
                onUpload={journal.addRecap}
                canPersist={canPersist}
              />
            ) : null}
            {view === 'notes' ? (
              <Notes
                notes={notes}
                onChange={journal.setNotes}
                days={metrics.days}
                onPersist={journal.saveNote}
                canPersist={canPersist}
              />
            ) : null}
          </>
        )}
      </main>

      <LogTradeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        vocabulary={vocabulary}
        onSave={journal.addTrade}
        canPersist={canPersist}
      />

      <TagManagerDialog
        open={tagManagerOpen}
        tags={journal.tags}
        onCreate={journal.createTag}
        onRename={journal.renameTag}
        onDelete={journal.deleteTag}
        onClose={() => setTagManagerOpen(false)}
      />
    </div>
  )
}

function Notice({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className={`${GLASS} mx-auto max-w-xl p-8 text-center`}>
      <div className="mb-3 flex justify-center">{icon}</div>
      <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">{body}</p>
      {action}
    </div>
  )
}
