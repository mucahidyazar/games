/// <reference types="vite/client" />

/** Public build-time settings. See `.env.example` for what each one does. */
interface ImportMetaEnv {
  /** Which site this build is: `portal` (games.mucahid.dev) or `traptheorb`. Unset: resolved from the hostname. */
  readonly VITE_SITE?: string
  /** Canonical base URL, no trailing slash. Defaults to the site's own URL. */
  readonly VITE_SITE_URL?: string
  /** Contact address shown in the privacy policy. */
  readonly VITE_CONTACT_EMAIL?: string
  /** Google AdSense publisher id, e.g. `ca-pub-1234567890123456`. */
  readonly VITE_ADSENSE_CLIENT?: string
  /** Numeric AdSense ad unit id for the sidebar slot. */
  readonly VITE_ADSENSE_SLOT_SIDEBAR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
