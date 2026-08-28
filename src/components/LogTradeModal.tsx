import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  CheckIcon,
  FileVideoIcon,
  ImageIcon,
  LoaderIcon,
  TriangleAlertIcon,
  UploadCloudIcon,
  XIcon,
} from 'lucide-react'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { fmtSignedCurrency, fmtSignedPoints } from '@/lib/format'
import { INSTRUMENTS, netPnl, netPoints, POINT_VALUE } from '@/lib/instruments'
import { fmtFileSize, isAcceptedMedia, isVideoFile, MEDIA_ACCEPT } from '@/lib/media'
import type { UploadPhase, UploadProgress } from '@/lib/storage'
import type { TagVocabulary } from '@/lib/tags'
import type { Trade } from '@/types'

/**
 * Prices and size stay strings in form state so an empty field is
 * distinguishable from a zero. Number('') is 0, which would otherwise make a
 * blank price look like a valid fill.
 */
const decimal = (label: string) =>
  z
    .string()
    .trim()
    .min(1, label + ' is required')
    .refine((v) => Number.isFinite(Number(v)), 'Enter a number')

const schema = z.object({
  instrument: z.enum(['NQ', 'MNQ']),
  direction: z.enum(['Long', 'Short']),
  contracts: decimal('Contracts').refine(
    (v) => Number.isInteger(Number(v)) && Number(v) >= 1,
    'At least 1 contract',
  ),
  entryPrice: decimal('Entry price').refine((v) => Number(v) > 0, 'Must be above 0'),
  exitPrice: decimal('Exit price').refine((v) => Number(v) > 0, 'Must be above 0'),
  entryTime: z.string().min(1, 'Execution time is required'),
  fees: z
    .string()
    .trim()
    .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Enter a number'),
  setups: z.array(z.string()),
  mistakes: z.array(z.string()),
})

type TradeFormValues = z.infer<typeof schema>

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in *local* time, not an ISO UTC string. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emptyForm(): TradeFormValues {
  const now = toLocalInput(new Date())
  return {
    instrument: 'NQ',
    direction: 'Long',
    contracts: '1',
    entryPrice: '',
    exitPrice: '',
    entryTime: now,
    fees: '0.00',
    setups: [],
    mistakes: [],
  }
}

interface Props {
  open: boolean
  onClose: () => void
  vocabulary: TagVocabulary
  /** Uploads the files, inserts the trade, and updates global state. */
  onSave: (
    draft: Omit<Trade, 'id' | 'attachments'>,
    files: File[],
    onProgress?: (progress: UploadProgress) => void,
  ) => Promise<unknown>
  /** Disables saving when there is no database to save to. */
  canPersist: boolean
}

export function LogTradeModal({ open, onClose, vocabulary, onSave, canPersist }: Props) {
  const [files, setFiles] = useState<File[]>([])
  /** Upload lifecycle per file, index-aligned with `files`. */
  const [phases, setPhases] = useState<UploadPhase[]>([])
  /** Bytes sent per file, where the service reports them. Videos only. */
  const [percents, setPercents] = useState<(number | undefined)[]>([])
  const [rejected, setRejected] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyForm(),
    mode: 'onChange',
  })

  // Each opening starts from a clean slate rather than the last trade's numbers.
  useEffect(() => {
    if (open) {
      form.reset(emptyForm())
      setFiles([])
      setPhases([])
      setPercents([])
      setRejected([])
      setSaveError(null)
      setSubmitting(false)
    }
  }, [open, form])

  const [contracts, entryPrice, exitPrice] = useWatch({
    control: form.control,
    name: ['contracts', 'entryPrice', 'exitPrice'],
  })

  // Named in the button while a save is in flight, so a large recording does
  // not look like a hung dialog.
  const uploadingIndex = phases.indexOf('uploading')

  // The spec's gate: a fill is not loggable until both prices and a size exist.
  const canSave =
    contracts?.trim() !== '' && entryPrice?.trim() !== '' && exitPrice?.trim() !== ''

  /** Keeps picked and dropped files on one path, with one acceptance rule. */
  const acceptFiles = (incoming: File[]) => {
    const ok = incoming.filter(isAcceptedMedia)
    const bad = incoming.filter((f) => !isAcceptedMedia(f)).map((f) => f.name)

    if (ok.length) {
      setFiles((current) => [...current, ...ok])
      setPhases((current) => [...current, ...ok.map((): UploadPhase => 'pending')])
      setPercents((current) => [...current, ...ok.map(() => undefined)])
    }
    // Say which files were ignored rather than dropping them silently.
    setRejected(bad)
  }

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index))
    setPhases((current) => current.filter((_, i) => i !== index))
    setPercents((current) => current.filter((_, i) => i !== index))
  }

  const onSubmit = async (values: TradeFormValues) => {
    const points = netPoints(
      Number(values.entryPrice),
      Number(values.exitPrice),
      values.direction,
    )
    const fees = Number(values.fees || 0)
    const contracts = Number(values.contracts)
    const entry = new Date(values.entryTime)

    setSubmitting(true)
    setSaveError(null)
    setPhases(files.map((): UploadPhase => 'pending'))
    setPercents(files.map(() => undefined))
    try {
      await onSave(
        {
          symbol: values.instrument,
          direction: values.direction,
          lots: contracts,
          entryPrice: Number(values.entryPrice),
          exitPrice: Number(values.exitPrice),
          entryTime: entry.toISOString(),
          exitTime: entry.toISOString(),
          durationMin: 0,
          pnl: netPnl(points, contracts, values.instrument, fees),
          commission: fees,
          setups: values.setups,
          mistakes: values.mistakes,
        },
        files,
        ({ index, phase, percent }) => {
          setPhases((current) => current.map((p, i) => (i === index ? phase : p)))
          if (percent !== undefined) {
            setPercents((current) => current.map((p, i) => (i === index ? percent : p)))
          }
        },
      )
      onClose()
    } catch (err) {
      // Keep the dialog open with the data intact so the entry isn't lost.
      setSaveError(err instanceof Error ? err.message : 'Could not save the trade.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 overflow-hidden border border-zinc-800/80 bg-zinc-900/80 p-0 shadow-2xl ring-0 backdrop-blur-2xl sm:max-w-3xl">
        <DialogHeader className="border-b border-zinc-800/80 px-5 py-4">
          <DialogTitle className="text-base">Log Trade</DialogTitle>
          <DialogDescription>
            Record a fill on NQ or MNQ. P&amp;L updates as you type.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid max-h-[65vh] gap-6 overflow-y-auto p-5 md:grid-cols-2">
              {/* ------------------------------------------- execution */}
              <div className="space-y-4">
                <SectionLabel>Trade Execution</SectionLabel>

                <FormField
                  control={form.control}
                  name="instrument"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instrument</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          spacing={0}
                          value={field.value}
                          onValueChange={(v) => v && field.onChange(v)}
                          className="w-full"
                        >
                          {INSTRUMENTS.map((symbol) => (
                            <ToggleGroupItem
                              key={symbol}
                              value={symbol}
                              className="flex-1 border-zinc-700/70 data-[state=on]:bg-white/10 data-[state=on]:text-zinc-50"
                            >
                              {symbol}
                              <span className="ml-1.5 text-[11px] text-muted-foreground">
                                ${POINT_VALUE[symbol]}/pt
                              </span>
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="direction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Direction</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          spacing={0}
                          value={field.value}
                          onValueChange={(v) => v && field.onChange(v)}
                          className="w-full"
                        >
                          {/* Blue / magenta, matching the dashboard's direction donut. */}
                          <ToggleGroupItem
                            value="Long"
                            className="flex-1 border-zinc-700/70 data-[state=on]:bg-[#3987e5]/15 data-[state=on]:text-[#6ba7ec]"
                          >
                            Long
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="Short"
                            className="flex-1 border-zinc-700/70 data-[state=on]:bg-[#d55181]/15 data-[state=on]:text-[#e08bac]"
                          >
                            Short
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contracts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Contracts</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} step={1} inputMode="numeric" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="entryPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entry Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.25"
                            inputMode="decimal"
                            placeholder="23150.25"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="exitPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exit Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.25"
                            inputMode="decimal"
                            placeholder="23178.75"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="entryTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Execution Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fees / Commissions</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min={0} inputMode="decimal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <PnlSummary control={form.control} />
              </div>

              {/* ---------------------------------- qualitative & media */}
              <div className="space-y-4">
                <SectionLabel>Context</SectionLabel>

                <FormField
                  control={form.control}
                  name="setups"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Setups</FormLabel>
                      <BadgePicker
                        options={vocabulary.setups}
                        selected={field.value}
                        onToggle={field.onChange}
                        selectedClass="bg-zinc-100 text-zinc-900 hover:bg-white"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mistakes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mistakes &amp; Emotions</FormLabel>
                      <BadgePicker
                        options={vocabulary.mistakes}
                        selected={field.value}
                        onToggle={field.onChange}
                        /* Amber, not loss-red: a mistake is a caution flag, not a P&L sign. */
                        selectedClass="bg-[#fab219]/15 text-[#fab219] ring-1 ring-[#fab219]/40 hover:bg-[#fab219]/25"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <p className="text-sm leading-none font-medium">Attachments</p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={MEDIA_ACCEPT}
                    className="sr-only"
                    onChange={(e) => {
                      acceptFiles(Array.from(e.target.files ?? []))
                      // Reset, so re-picking the same file still fires a change.
                      e.target.value = ''
                    }}
                  />

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
                      acceptFiles(Array.from(e.dataTransfer.files))
                    }}
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/70 bg-zinc-950/40 px-4 py-8 text-center transition-colors hover:border-zinc-600 hover:bg-zinc-950/60"
                  >
                    <UploadCloudIcon className="size-6 text-zinc-500" aria-hidden="true" />
                    <p className="text-sm font-medium text-zinc-300">
                      Drag &amp; drop screenshots or recordings, or click to browse
                    </p>
                    <p className="text-xs text-zinc-500">
                      Images and MP4, WebM or MOV video · screenshots upload to Supabase,
                      recordings to Cloudinary
                    </p>
                  </div>

                  {rejected.length > 0 ? (
                    <p className="flex items-start gap-1.5 text-[11px] text-[#fab219]" role="alert">
                      <TriangleAlertIcon
                        className="mt-px size-3 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Skipped {rejected.join(', ')} — only images and MP4, WebM or MOV video can
                        be attached.
                      </span>
                    </p>
                  ) : null}

                  {files.length > 0 ? (
                    <ul className="space-y-1">
                      {files.map((file, i) => (
                        <AttachmentRow
                          key={`${file.name}-${i}`}
                          file={file}
                          phase={phases[i] ?? 'pending'}
                          percent={percents[i]}
                          busy={submitting}
                          onRemove={() => removeFile(i)}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>

            <DialogFooter className="mx-0 mb-0 items-center border-t border-zinc-800 bg-zinc-950/40 px-5 py-4 sm:justify-between">
              <p className="text-[11px] text-[#d03b3b]" role={saveError ? 'alert' : undefined}>
                {saveError ?? (canPersist ? '' : 'Connect Supabase to save trades.')}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSave || submitting || !canPersist}>
                  {submitting ? (
                    <>
                      <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                      {uploadingIndex >= 0
                        ? `Uploading ${uploadingIndex + 1} of ${files.length}…`
                        : 'Saving…'}
                    </>
                  ) : (
                    'Save Trade'
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

/* ------------------------------------------------------------------ pieces */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">{children}</h3>
  )
}

interface BadgePickerProps {
  options: readonly string[]
  selected: string[]
  onToggle: (next: string[]) => void
  selectedClass: string
}

function BadgePicker({ options, selected, onToggle, selectedClass }: BadgePickerProps) {
  const base = 'h-7 cursor-pointer px-3 text-[13px]'

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = selected.includes(option)
        return (
          <Badge
            key={option}
            asChild
            variant="outline"
            className={
              on
                ? base + ' border-transparent ' + selectedClass
                : base + ' border-zinc-600/70 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            }
          >
            <button
              type="button"
              aria-pressed={on}
              onClick={() =>
                onToggle(on ? selected.filter((s) => s !== option) : [...selected, option])
              }
            >
              {option}
            </button>
          </Badge>
        )
      })}
    </div>
  )
}

/**
 * Live P&L. Subscribes to just the fields it needs, so typing a price
 * recomputes here without re-rendering the rest of the form.
 */
function PnlSummary({ control }: { control: Control<TradeFormValues> }) {
  const [instrument, direction, contracts, entryPrice, exitPrice, fees] = useWatch({
    control,
    name: ['instrument', 'direction', 'contracts', 'entryPrice', 'exitPrice', 'fees'],
  })

  const priced = entryPrice?.trim() !== '' && exitPrice?.trim() !== ''
  const size = Number(contracts || 0)

  const points = priced ? netPoints(Number(entryPrice), Number(exitPrice), direction) : 0
  const pnl = priced ? netPnl(points, size, instrument, Number(fees || 0)) : 0

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 ring-1 ring-white/5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] tracking-wider text-zinc-500 uppercase">Net Points</span>
        <span className={'text-sm font-semibold tabular-nums ' + pnlClass(priced ? points : null)}>
          {priced ? fmtSignedPoints(points) : '—'}
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t border-zinc-800/80 pt-2">
        <span className="text-[11px] tracking-wider text-zinc-500 uppercase">Net P&amp;L</span>
        <span className={'text-xl font-semibold tabular-nums ' + pnlClass(priced ? pnl : null)}>
          {priced ? fmtSignedCurrency(pnl, true) : '—'}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-zinc-600">
        {size || 0} × ${POINT_VALUE[instrument]}/pt{' '}
        {Number(fees || 0) > 0 ? 'less $' + Number(fees).toFixed(2) + ' fees' : 'no fees'}
      </p>
    </div>
  )
}

const pnlClass = (value: number | null) =>
  value === null || value === 0
    ? 'text-zinc-400'
    : value > 0
      ? 'text-[#0ca30c]'
      : 'text-[#d03b3b]'

/* ------------------------------------------------------- attachment row */

const PHASE_LABEL: Record<UploadPhase, string> = {
  pending: 'Queued',
  uploading: 'Uploading…',
  done: 'Uploaded',
  error: 'Failed',
}

interface AttachmentRowProps {
  file: File
  phase: UploadPhase
  /** Bytes sent, 0-100; undefined when the service reports no progress. */
  percent?: number
  /** True once the save is in flight; files can no longer be removed. */
  busy: boolean
  onRemove: () => void
}

/**
 * One queued file, with its upload state.
 *
 * Videos go to Cloudinary over XHR, which reports real byte counts, so their
 * bar fills and the label carries a percentage. Images go through supabase-js,
 * which exposes nothing, so their bar sweeps instead — an honest "in flight"
 * rather than a percentage that would be invented.
 */
function AttachmentRow({ file, phase, percent, busy, onRemove }: AttachmentRowProps) {
  const Icon = isVideoFile(file) ? FileVideoIcon : ImageIcon
  const measured = phase === 'uploading' && percent !== undefined

  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-zinc-300">{file.name}</span>
        <span className="shrink-0 text-[11px] text-zinc-600 tabular-nums">
          {fmtFileSize(file.size)}
        </span>

        {busy ? (
          <span
            className={
              'flex shrink-0 items-center gap-1 text-[11px] ' +
              (phase === 'error'
                ? 'text-[#d03b3b]'
                : phase === 'done'
                  ? 'text-[#0ca30c]'
                  : 'text-zinc-400')
            }
            role="status"
          >
            {phase === 'uploading' ? (
              <LoaderIcon className="size-3 animate-spin" aria-hidden="true" />
            ) : phase === 'done' ? (
              <CheckIcon className="size-3" aria-hidden="true" />
            ) : phase === 'error' ? (
              <TriangleAlertIcon className="size-3" aria-hidden="true" />
            ) : null}
            {measured ? `${percent}%` : PHASE_LABEL[phase]}
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={onRemove}
            className="flex size-5 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>

      {busy && phase !== 'pending' ? (
        <div
          className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-zinc-800"
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
      ) : null}
    </li>
  )
}
