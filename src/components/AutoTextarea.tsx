import { useLayoutEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  ariaLabel?: string
  /** Rows-worth of height the field never shrinks below. */
  minRows?: number
}

/**
 * A textarea that grows with its content instead of scrolling.
 *
 * Height is measured in a layout effect rather than on the change event, so it
 * is also correct when the value changes from outside — switching notes swaps
 * the text without any typing, and a change-handler-only version would leave
 * the previous note's height behind.
 */
export function AutoTextarea({
  value,
  onChange,
  placeholder,
  ariaLabel,
  minRows = 3,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Collapse first, or scrollHeight can only ever report growth.
    el.style.height = 'auto'
    // scrollHeight covers content + padding but NOT the border. Under
    // border-box sizing the border then eats into the content area and clips
    // the last line by a pixel or two, so add it back explicitly.
    const style = getComputedStyle(el)
    const border =
      parseFloat(style.borderTopWidth || '0') + parseFloat(style.borderBottomWidth || '0')
    el.style.height = `${el.scrollHeight + border}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={minRows}
      className="w-full resize-none overflow-hidden rounded-lg border border-zinc-700/70 bg-zinc-950/50 p-3 text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus-visible:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-500/30 focus-visible:outline-none"
    />
  )
}
