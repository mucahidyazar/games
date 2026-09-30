const SCRIPT_ID = 'adsbygoogle-js'
const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

/** Adds the AdSense loader once; later calls are no-ops. */
export function loadAdSense(client: string): void {
  if (typeof document === 'undefined' || document.getElementById(SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `${ADSENSE_SRC}?client=${encodeURIComponent(client)}`
  document.head.append(script)
}
