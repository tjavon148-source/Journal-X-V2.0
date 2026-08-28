/**
 * Video delivery, split out from Supabase.
 *
 * Images stay in the `trade-attachments` bucket, but video goes to Cloudinary:
 * it transcodes and streams recordings, which Supabase Storage does not, and it
 * keeps multi-hundred-megabyte screen captures off the bucket's size limit.
 *
 * Only the resulting `secure_url` comes back into the app. Attachments are
 * still a plain `text[]` of URLs, so nothing downstream needs to know which of
 * the two services a given attachment came from.
 */

/**
 * Unsigned uploads. The preset — not a secret — is what authorises the upload,
 * and it must be marked "unsigned" in the Cloudinary console. No API secret is
 * involved, which is the point: a signing key in a `VITE_` variable would be
 * compiled into the bundle and readable by every visitor.
 */
const DEFAULT_CLOUD_NAME = 'ewoj42z2'
const DEFAULT_UPLOAD_PRESET = 'trading_journal_uploads'

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || DEFAULT_CLOUD_NAME
const uploadPreset =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || DEFAULT_UPLOAD_PRESET

export const cloudinaryConfig = { cloudName, uploadPreset } as const

/** False only if someone blanks the defaults out; video uploads then fail loudly. */
export const isCloudinaryConfigured = Boolean(cloudName && uploadPreset)

const uploadEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`

/** Cloudinary's response shape, narrowed to the one field the app stores. */
interface CloudinaryUploadResponse {
  secure_url?: string
  error?: { message?: string }
}

/**
 * Cloudinary reports failures as `{ error: { message } }` with a 4xx. The ones a
 * user actually hits are a recording over the plan's per-file cap, a preset
 * that was never switched to unsigned, and a container Cloudinary cannot
 * decode, so each says what to change rather than echoing the API string.
 */
function describeCloudinaryError(fileName: string, status: number, message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('file size too large') || lower.includes('too large')) {
    return `${fileName} exceeds the maximum video size for this Cloudinary account. Trim the recording, or raise the limit on your Cloudinary plan.`
  }
  if (lower.includes('upload preset') && lower.includes('whitelist')) {
    return `The Cloudinary upload preset "${uploadPreset}" is not enabled for unsigned uploads. Set its signing mode to "Unsigned" in Settings → Upload.`
  }
  if (lower.includes('upload preset not found') || lower.includes('unknown api key')) {
    return `Cloudinary rejected the upload preset "${uploadPreset}" for cloud "${cloudName}". Check VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.`
  }
  if (lower.includes('unsupported video format')) {
    return `Cloudinary could not decode ${fileName}. Re-export it as MP4 (H.264) or WebM.`
  }
  if (message) return `Cloudinary rejected ${fileName}: ${message}`
  return `Cloudinary rejected ${fileName} (HTTP ${status}).`
}

/**
 * Uploads one video and resolves to its `secure_url`.
 *
 * XMLHttpRequest rather than `fetch`, purely for `upload.onprogress`: a screen
 * recording takes long enough that a real byte count is worth having, and fetch
 * still cannot report request progress. Images keep the indeterminate indicator
 * because supabase-js exposes no equivalent.
 */
export function uploadVideoToCloudinary(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (!isCloudinaryConfigured) {
    return Promise.reject(
      new Error(
        'Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET, then restart the dev server.',
      ),
    )
  }

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', uploadPreset)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadEndpoint)

    xhr.upload.onprogress = (event) => {
      // `lengthComputable` is false for a chunked request; leave the caller on
      // its indeterminate bar rather than reporting a made-up number.
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      let parsed: CloudinaryUploadResponse = {}
      try {
        parsed = JSON.parse(xhr.responseText) as CloudinaryUploadResponse
      } catch {
        reject(new Error(`Cloudinary returned an unreadable response for ${file.name}.`))
        return
      }

      if (xhr.status >= 200 && xhr.status < 300 && parsed.secure_url) {
        resolve(parsed.secure_url)
        return
      }
      reject(
        new Error(describeCloudinaryError(file.name, xhr.status, parsed.error?.message ?? '')),
      )
    }

    // A cross-origin failure surfaces here with no detail at all, so the
    // message names the likely causes rather than pretending to know.
    xhr.onerror = () =>
      reject(
        new Error(
          `Could not reach Cloudinary to upload ${file.name}. Check your connection and that cloud "${cloudName}" exists.`,
        ),
      )
    xhr.onabort = () => reject(new Error(`Upload of ${file.name} was cancelled.`))

    xhr.send(body)
  })
}
