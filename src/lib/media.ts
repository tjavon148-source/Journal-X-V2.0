/**
 * What counts as an attachment, and how to tell one kind from another.
 *
 * Attachments are stored as bare URLs in a `text[]` column — there is no
 * per-file MIME column to read back, and the URL may point at either service
 * (Supabase Storage for images, Cloudinary for video). So the *renderer*
 * classifies by URL shape, while the *picker* classifies by the browser-reported
 * MIME type. Both rules live here so they can never drift apart.
 */

/** Video containers the dropzone accepts and the player renders. */
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const

/** Matching extensions — quicktime is `.mov`, which is not derivable from the type. */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'] as const

/**
 * The `accept` attribute for a file input taking screenshots or recordings.
 * `image/*` covers png/jpg/webp/gif; videos are listed explicitly because
 * `video/*` would also invite formats the <video> tag cannot play back.
 */
export const MEDIA_ACCEPT = ['image/*', ...VIDEO_MIME_TYPES].join(',')

/**
 * True for a File that should be treated as a video.
 *
 * Drag-and-drop from some file managers hands over an empty `type`, so the name
 * is the fallback — a legitimate .mov must not be mistaken for a screenshot.
 */
export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  return file.type === '' && isVideoUrl(file.name)
}

/** True for a File the user picked or dropped that we are willing to upload. */
export function isAcceptedMedia(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) return true
  return isVideoFile(file)
}

/** The path part of a URL, without the query string a signed URL may carry. */
function pathOf(url: string): string {
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

/**
 * True for a Cloudinary *video* delivery URL.
 *
 * Cloudinary's resource type is a path segment: `/video/upload/…` for video and
 * `/image/upload/…` for stills. That segment is the reliable signal, because a
 * transformed or extensionless delivery URL may not end in `.mp4` at all.
 */
function isCloudinaryVideoUrl(path: string): boolean {
  return path.includes('cloudinary.com/') && path.includes('/video/upload/')
}

/** True when the URL points at a video we should render in a player. */
export function isVideoUrl(url: string): boolean {
  // Extensions are matched case-insensitively — ".MOV" off a phone is a video.
  const path = pathOf(url).toLowerCase()
  if (isCloudinaryVideoUrl(path)) return true
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext))
}

/** The stored file name, readable again: "…/9f2c-Entry%20setup.png" -> "9f2c-Entry setup.png". */
export function fileNameFromUrl(url: string, fallback: string): string {
  // Case is preserved here, unlike in the extension test: this string is shown
  // to the user, and lower-casing it mangles the name they uploaded.
  const last = pathOf(url).split('/').pop()
  if (!last) return fallback
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

/** "1.4 MB" / "812 KB" — attachment sizes span screenshots and screen recordings. */
export function fmtFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Reads a video's real runtime from its metadata.
 *
 * Recap runtime is shown next to derived, estimated runtimes, so an uploaded
 * recording reporting its actual length is worth the round trip. Resolves to 0
 * rather than rejecting when the browser cannot decode the container — a recap
 * with an unknown runtime is still a usable recap.
 */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const done = (seconds: number) => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0)
    }
    video.preload = 'metadata'
    video.onloadedmetadata = () => done(video.duration)
    video.onerror = () => done(0)
    video.src = url
  })
}
