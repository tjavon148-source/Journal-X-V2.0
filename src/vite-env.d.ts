/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Cloudinary cloud that receives video uploads. */
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string
  /** Unsigned upload preset on that cloud. Not a secret. */
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
