import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileVideoIcon, LoaderIcon, TriangleAlertIcon, UploadCloudIcon, XIcon } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AutoTextarea } from './AutoTextarea'
import { fmtRuntime } from './RecapThumb'
import { fmtDayLabel, fmtShortDate, toISODate } from '../lib/format'
import { fmtFileSize, isVideoFile, readVideoDuration, VIDEO_MIME_TYPES } from '../lib/media'
import type { UploadPhase, UploadProgress } from '../lib/storage'
import type { StoredRecap } from '../lib/rows'

const schema = z
  .object({
    kind: z.enum(['Daily', 'Weekly']),
    date: z.string().min(1, 'Pick a date'),
    endDate: z.string(),
    title: z.string(),
    notes: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.kind !== 'Weekly') return
    if (!values.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'A weekly review needs an end date',
      })
      return
    }
    if (values.endDate < values.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'The week cannot end before it starts',
      })
    }
  })

type RecapFormValues = z.infer<typeof schema>

/** Videos only here — this dialog exists to attach a recording. */
const VIDEO_ACCEPT = VIDEO_MIME_TYPES.join(',')

function emptyForm(): RecapFormValues {
  return {
    kind: 'Daily',
    date: toISODate(new Date()),
    endDate: '',
    title: '',
    notes: '',
  }
}

/** The title used when the field is left blank, matching the derived library's phrasing. */
function defaultTitle(kind: RecapFormValues['kind'], date: string, endDate: string): string {
  if (!date) return ''
  return kind === 'Weekly'
    ? `Week of ${fmtShortDate(date)}${endDate ? ` – ${fmtShortDate(endDate)}` : ''} — Weekly Review`
    : `${fmtDayLabel(date)} — Session Recap`
}

interface Props {
  open: boolean
  onClose: () => void
  /** Uploads the recording, inserts the row, and updates global state. */
  onSave: (
    draft: Omit<StoredRecap, 'id' | 'videoUrl'>,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
  ) => Promise<unknown>
  /** Disables saving when there is no database to save to. */
  canPersist: boolean
}

/**
 * Uploads a stand-alone daily or weekly review recording.
 *
 * The file goes to Cloudinary — the same route trade recordings take — and only
 * its `secure_url` is stored, in the `video_recaps` row. An upload that fails,
 * most often a recording over the account's size cap, leaves the dialog open
 * with every field intact and reports why inline, because re-typing the notes
 * would be the real loss.
 */
export function UploadRecapModal({ open, onClose, onSave, canPersist }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [durationSec, setDurationSec] = useState(0)
  const [phase, setPhase] = useState<UploadPhase>('pending')
  /** Bytes sent, from Cloudinary's XHR progress events. */
  const [percent, setPercent] = useState<number | undefined>(undefined)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<RecapFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyForm(),
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      form.reset(emptyForm())
      setFile(null)
      setDurationSec(0)
      setPhase('pending')
      setPercent(undefined)
      setSaveError(null)
      setSubmitting(false)
    }
  }, [open, form])

  const [kind, date, endDate] = useWatch({
    control: form.control,
    name: ['kind', 'date', 'endDate'],
  })
  const derivedTitle = defaultTitle(kind, date, endDate)
  // Cloudinary reports real bytes; fall back to the sweeping bar if it does not.
  const measured = phase === 'uploading' && percent !== undefined

  const acceptFile = async (picked: File | undefined) => {
    if (!picked) return
    if (!isVideoFile(picked)) {
      setSaveError(`${picked.name} is not a video. Upload an MP4, WebM or MOV recording.`)
      return
    }
    setSaveError(null)
    setPhase('pending')
    setPercent(undefined)
    setFile(picked)
    setDurationSec(await readVideoDuration(picked))
  }

  const onSubmit = async (values: RecapFormValues) => {
    if (!file) {
      setSaveError('Choose a recording to upload.')
      return
    }

    setSubmitting(true)
    setSaveError(null)
    setPhase('pending')
    setPercent(undefined)
    try {
      await onSave(
        {
          kind: values.kind,
          date: values.date,
          endDate: values.kind === 'Weekly' ? values.endDate : undefined,
          title: values.title.trim() || derivedTitle,
          notes: values.notes.trim(),
          durationSec,
        },
        file,
        ({ phase: next, percent: sent }) => {
          setPhase(next)
          if (sent !== undefined) setPercent(sent)
        },
      )
      onClose()
    } catch (err) {
      // Nothing is reset here on purpose: the notes the user just wrote are the
      // expensive part of this form, and a size-limit rejection is retryable.
      setPhase('error')
      setSaveError(err instanceof Error ? err.message : 'Could not upload the recap.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent className="gap-0 overflow-hidden border border-zinc-800/80 bg-zinc-900/80 p-0 shadow-2xl ring-0 backdrop-blur-2xl sm:max-w-xl">
        <DialogHeader className="border-b border-zinc-800/80 px-5 py-4">
          <DialogTitle className="text-base">Upload Video Recap</DialogTitle>
          <DialogDescription>
            A stand-alone daily or weekly review. The recording is uploaded to Cloudinary and
            plays back in the library.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="max-h-[65vh] space-y-4 overflow-y-auto p-5">
              {/* Inline notification: stays until dismissed or the next attempt. */}
              {saveError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#d03b3b]/40 bg-[#d03b3b]/10 px-3 py-2.5 text-xs leading-relaxed text-[#f0a3a3]"
                >
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{saveError}</span>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => setSaveError(null)}
                    className="flex size-5 shrink-0 items-center justify-center rounded text-[#f0a3a3]/70 hover:bg-white/10 hover:text-[#f0a3a3]"
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              ) : null}

              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Review Type</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        spacing={0}
                        value={field.value}
                        onValueChange={(v) => v && field.onChange(v)}
                        className="w-full"
                      >
                        <ToggleGroupItem
                          value="Daily"
                          className="flex-1 border-zinc-700/70 data-[state=on]:bg-white/10 data-[state=on]:text-zinc-50"
                        >
                          Daily
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="Weekly"
                          className="flex-1 border-zinc-700/70 data-[state=on]:bg-white/10 data-[state=on]:text-zinc-50"
                        >
                          Weekly
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{kind === 'Weekly' ? 'Week Starting' : 'Session Date'}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {kind === 'Weekly' ? (
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Week Ending</FormLabel>
                        <FormControl>
                          <Input type="date" min={date || undefined} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder={derivedTitle} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recap Notes</FormLabel>
                    <FormControl>
                      <AutoTextarea
                        value={field.value}
                        onChange={field.onChange}
                        minRows={3}
                        placeholder="What this review covers — the setups walked through, what to change next session."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* --------------------------------------------- recording */}
              <div className="space-y-2">
                <p className="text-sm leading-none font-medium">Recording</p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={VIDEO_ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    void acceptFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />

                {file ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <FileVideoIcon className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-zinc-200">{file.name}</span>
                      <span className="shrink-0 text-[11px] text-zinc-500 tabular-nums">
                        {fmtFileSize(file.size)}
                        {durationSec > 0 ? ` · ${fmtRuntime(durationSec)}` : ''}
                      </span>
                      {submitting ? null : (
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => {
                            setFile(null)
                            setDurationSec(0)
                            setPercent(undefined)
                          }}
                          className="flex size-5 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                        >
                          <XIcon className="size-3" />
                        </button>
                      )}
                    </div>

                    {submitting ? (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                        <div
                          className="h-0.5 flex-1 overflow-hidden rounded-full bg-zinc-800"
                          role={measured ? 'progressbar' : undefined}
                          aria-valuenow={measured ? percent : undefined}
                          aria-valuemin={measured ? 0 : undefined}
                          aria-valuemax={measured ? 100 : undefined}
                        >
                          <div
                            className={
                              phase === 'done'
                                ? 'h-full w-full rounded-full bg-[#0ca30c]'
                                : phase === 'error'
                                  ? 'h-full w-full rounded-full bg-[#d03b3b]'
                                  : measured
                                    ? 'h-full rounded-full bg-zinc-300 transition-[width] duration-200'
                                    : 'h-full w-1/3 animate-[indeterminate_1.1s_ease-in-out_infinite] rounded-full bg-zinc-300'
                            }
                            style={measured ? { width: `${percent}%` } : undefined}
                          />
                        </div>
                        <span role="status" className="shrink-0 tabular-nums">
                          {phase === 'done'
                            ? 'Saving recap…'
                            : measured
                              ? `Uploading to Cloudinary · ${percent}%`
                              : 'Uploading…'}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        fileInputRef.current?.click()
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      void acceptFile(e.dataTransfer.files[0])
                    }}
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/70 bg-zinc-950/40 px-4 py-8 text-center transition-colors hover:border-zinc-600 hover:bg-zinc-950/60"
                  >
                    <UploadCloudIcon className="size-6 text-zinc-500" aria-hidden="true" />
                    <p className="text-sm font-medium text-zinc-300">
                      Drag &amp; drop a recording, or click to browse
                    </p>
                    <p className="text-xs text-zinc-500">
                      MP4, WebM or MOV · uploaded to Cloudinary
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mx-0 mb-0 items-center border-t border-zinc-800 bg-zinc-950/40 px-5 py-4 sm:justify-between">
              <p className="text-[11px] text-zinc-500">
                {canPersist
                  ? 'Trade count and P&L are computed from the trades in this period.'
                  : 'Connect Supabase to upload recaps.'}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!file || submitting || !canPersist}>
                  {submitting ? (
                    <>
                      <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                      Uploading…
                    </>
                  ) : (
                    'Upload Recap'
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
