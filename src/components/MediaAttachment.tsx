import { FileVideoIcon, ImageIcon } from 'lucide-react'

import { isVideoUrl } from '../lib/media'

/**
 * One stored attachment, rendered as whatever it actually is.
 *
 * Attachments are just public URLs, so the extension is the only signal: a
 * `.mp4`/`.webm`/`.mov` gets a real player with controls, anything else gets a
 * full-resolution image. See src/lib/media.ts for the classification.
 */

interface MediaAttachmentProps {
  url: string
  /** Describes the attachment for screen readers; also the poster caption. */
  label: string
  className?: string
}

export function MediaAttachment({ url, label, className = '' }: MediaAttachmentProps) {
  if (isVideoUrl(url)) {
    return (
      <video
        controls
        preload="metadata"
        // Metadata-only preload means the grid does not pull whole recordings
        // down; the first frame is enough to identify the clip.
        aria-label={label}
        src={url}
        className={`w-full rounded-lg bg-black ${className}`}
      />
    )
  }

  return (
    // Only images get the open-in-a-tab wrapper: a link around a <video> would
    // swallow every click meant for the transport controls.
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt={label}
        loading="lazy"
        className={`w-full rounded-lg bg-black object-contain ${className}`}
      />
    </a>
  )
}

/** The icon for an attachment's kind, for captions and counts. */
export function MediaKindIcon({ url, className = 'size-3.5' }: { url: string; className?: string }) {
  return isVideoUrl(url) ? (
    <FileVideoIcon className={className} aria-hidden="true" />
  ) : (
    <ImageIcon className={className} aria-hidden="true" />
  )
}

/** "3 screenshots · 1 recording" — an honest count when the two are mixed. */
export function describeAttachments(urls: string[]): string {
  const videos = urls.filter(isVideoUrl).length
  const images = urls.length - videos
  const parts: string[] = []
  if (images > 0) parts.push(`${images} ${images === 1 ? 'screenshot' : 'screenshots'}`)
  if (videos > 0) parts.push(`${videos} ${videos === 1 ? 'recording' : 'recordings'}`)
  return parts.join(' · ') || 'nothing attached'
}
