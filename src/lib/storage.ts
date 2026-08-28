import type { SupabaseClient } from '@supabase/supabase-js'

import { ATTACHMENTS_BUCKET } from './supabase'
import { uploadVideoToCloudinary } from './cloudinary'
import { fmtFileSize, isVideoFile } from './media'

/**
 * The one place that decides where an attachment goes.
 *
 * Screenshots go to the Supabase `trade-attachments` bucket, separated by key
 * prefix so there is a single storage policy. Videos go to Cloudinary, which
 * transcodes and streams them and is not bound by the bucket's size limit.
 *
 * Both come back as a plain URL, and both land in the same `attachments`
 * `text[]`. Nothing downstream distinguishes them except the viewers, which
 * classify by URL — see src/lib/media.ts.
 */

/** Where each kind of upload lands inside the bucket. Images only. */
export type UploadFolder = 'trades' | 'recaps'

/** Per-file lifecycle, surfaced in the dialogs as a progress indicator. */
export type UploadPhase = 'pending' | 'uploading' | 'done' | 'error'

export interface UploadProgress {
  /** Index into the file list the caller passed in. */
  index: number
  phase: UploadPhase
  /**
   * Bytes sent, 0-100. Present only for Cloudinary video uploads, which report
   * real request progress; a Supabase image upload leaves this undefined and
   * the caller shows an indeterminate indicator instead of inventing a number.
   */
  percent?: number
  /** Set when `phase` is 'error'. */
  message?: string
}

/**
 * Storage keys must be URL-safe and unique. The original name is kept as a
 * readable suffix so the object is still identifiable in the Supabase
 * dashboard, and the UUID in front makes two files of the same name collide-proof.
 */
function storageKey(folder: UploadFolder, isoDate: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${folder}/${isoDate.slice(0, 10)}/${crypto.randomUUID()}-${safeName}`
}

/**
 * Storage errors arrive as terse API strings, so each is turned into something
 * that names the file and says what to change. Video no longer passes through
 * here — Cloudinary has its own messages in src/lib/cloudinary.ts.
 */
export function describeUploadError(fileName: string, size: number, message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('exceeded the maximum allowed size') || lower.includes('payload too large')) {
    return `${fileName} is ${fmtFileSize(size)}, which exceeds the storage bucket's file size limit. Trim the recording or raise the limit for the trade-attachments bucket in Supabase.`
  }
  if (lower.includes('mime type') || lower.includes('content type')) {
    return `${fileName} has a file type the trade-attachments bucket does not allow. Add it to the bucket's allowed MIME types in Supabase.`
  }
  if (lower.includes('already exists')) {
    return `${fileName} is already stored at that path.`
  }
  return `Upload failed for ${fileName}: ${message}`
}

/**
 * Uploads one image to the bucket and returns its public URL.
 *
 * supabase-js gives no byte-level progress event, so callers get lifecycle
 * transitions rather than a percentage — an honest indeterminate indicator
 * beats a progress bar that is really just an animation.
 */
async function uploadImageToSupabase(
  client: SupabaseClient,
  file: File,
  folder: UploadFolder,
  isoDate: string,
): Promise<string> {
  const path = storageKey(folder, isoDate, file.name)

  const { error } = await client.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      // Without this, a file dragged in with an empty `type` is stored as
      // text/plain and the browser refuses to play it back.
      contentType: file.type || undefined,
    })

  if (error) throw new Error(describeUploadError(file.name, file.size, error.message))

  const { data } = client.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Uploads one attachment, to whichever service handles its kind, and returns
 * the URL to store. Video goes to Cloudinary, everything else to the bucket.
 */
export function uploadFile(
  client: SupabaseClient,
  file: File,
  folder: UploadFolder,
  isoDate: string,
  onPercent?: (percent: number) => void,
): Promise<string> {
  return isVideoFile(file)
    ? uploadVideoToCloudinary(file, onPercent)
    : uploadImageToSupabase(client, file, folder, isoDate)
}

/**
 * Uploads a list in order, reporting each file's phase as it goes.
 *
 * Sequential rather than parallel: the indicator then names one file at a time,
 * and a rejection on file three does not leave three half-finished requests in
 * flight — which matters more now that a single video can be hundreds of
 * megabytes.
 */
export async function uploadFiles(
  client: SupabaseClient,
  files: File[],
  folder: UploadFolder,
  isoDate: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string[]> {
  const urls: string[] = []

  for (let index = 0; index < files.length; index++) {
    const file = files[index]
    onProgress?.({ index, phase: 'uploading' })
    try {
      urls.push(
        await uploadFile(client, file, folder, isoDate, (percent) =>
          onProgress?.({ index, phase: 'uploading', percent }),
        ),
      )
      onProgress?.({ index, phase: 'done' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.'
      onProgress?.({ index, phase: 'error', message })
      throw err
    }
  }

  return urls
}
