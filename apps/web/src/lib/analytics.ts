import { useEffect, useSyncExternalStore } from 'react'
import { useLocation } from '@/app/router'

const GTM_SCRIPT_ID = 'games-gtm-js'
const GA_SCRIPT_ID = 'games-ga-js'
const CONSENT_STORAGE_KEY = 'games.analytics-consent.v1'
const CONSENT_EVENT = 'games:analytics-consent'

export type AnalyticsConsent = 'granted' | 'denied' | null

export interface AnalyticsConfig {
  readonly gtmId: string | null
  readonly gaId: string | null
}

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/i
const GA_ID_PATTERN = /^G-[A-Z0-9]+$/i

function valid(value: string | undefined, pattern: RegExp): string | null {
  const candidate = value?.trim() ?? ''
  return candidate !== '' && pattern.test(candidate) ? candidate : null
}

/** GTM wins intentionally: a direct GA tag plus a GA tag in GTM would double-count. */
export function parseAnalyticsEnv(env: { readonly VITE_GTM_ID?: string; readonly VITE_GA_ID?: string }): AnalyticsConfig {
  const gtmId = valid(env.VITE_GTM_ID, GTM_ID_PATTERN)
  return Object.freeze({ gtmId, gaId: gtmId === null ? valid(env.VITE_GA_ID, GA_ID_PATTERN) : null })
}

export const analyticsConfig: AnalyticsConfig = parseAnalyticsEnv(import.meta.env)
let memoryConsent: AnalyticsConsent = null

function canUseStorage(): boolean {
  return typeof window !== 'undefined'
}

export function readAnalyticsConsent(): AnalyticsConsent {
  if (!canUseStorage()) return null
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    return value === 'granted' || value === 'denied' ? value : memoryConsent
  } catch {
    return memoryConsent
  }
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>): void {
  memoryConsent = consent
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent)
  } catch {
    // A blocked storage area must not prevent the visitor from using the site.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT))
  if (consent === 'denied' && initialized) {
    window.gtag?.('consent', 'update', consentState('denied'))
    // A downloaded third-party library cannot be unloaded by removing its script.
    // Reload after persisting withdrawal so basic consent blocks it on the new page.
    window.location.reload()
  }
}

function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange)
  const onStorage = () => { memoryConsent = null; onChange() }
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

const getConsent = (): AnalyticsConsent => readAnalyticsConsent()
const getServerConsent = (): AnalyticsConsent => null

export function useAnalyticsConsent(): AnalyticsConsent {
  return useSyncExternalStore(subscribeConsent, getConsent, getServerConsent)
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let initialized = false
let lastPagePath: string | null = null

function consentState(analytics: 'denied' | 'granted') {
  return { analytics_storage: analytics, ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }
}

/** Returns only a pathname. Query strings, fragments and event payloads never leave the browser. */
export function pathForAnalytics(pathname = typeof window === 'undefined' ? '/' : window.location.pathname): string {
  const path = pathname.split(/[?#]/, 1)[0] ?? '/'
  return path.startsWith('/') ? path || '/' : `/${path}`
}

function appendScript(id: string, src: string): void {
  if (document.getElementById(id)) return
  const script = document.createElement('script')
  script.id = id
  script.async = true
  script.src = src
  document.head.append(script)
}

/** Loads exactly one Google integration, and only after the caller has consent. */
export function initializeAnalytics(): boolean {
  if (readAnalyticsConsent() !== 'granted') return false
  if (initialized || typeof document === 'undefined') return initialized
  window.dataLayer = window.dataLayer ?? []
  window.gtag = function () { window.dataLayer?.push(arguments) }
  window.gtag('consent', 'default', consentState('denied'))
  window.gtag('consent', 'update', consentState('granted'))
  const pageLocation = `${window.location.origin}${pathForAnalytics()}`
  window.gtag('set', { page_location: pageLocation, page_referrer: '' })
  if (analyticsConfig.gtmId !== null) {
    window.dataLayer = window.dataLayer ?? []
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    appendScript(GTM_SCRIPT_ID, `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(analyticsConfig.gtmId)}`)
    initialized = true
    return true
  }
  if (analyticsConfig.gaId !== null) {
    window.dataLayer = window.dataLayer ?? []
    window.gtag('js', new Date())
    window.gtag('config', analyticsConfig.gaId, { send_page_view: false, page_location: pageLocation, page_referrer: '' })
    appendScript(GA_SCRIPT_ID, `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsConfig.gaId)}`)
    initialized = true
    return true
  }
  return false
}

/** Sends one path-only view per pathname for the lifetime of this page. */
export function trackPageView(pathname: string): boolean {
  if (!initialized || readAnalyticsConsent() !== 'granted') return false
  const pagePath = pathForAnalytics(pathname)
  if (pagePath === lastPagePath) return false

  const parameters = { page_path: pagePath, page_location: `${window.location.origin}${pagePath}`, page_referrer: '' }
  if (analyticsConfig.gtmId !== null) {
    window.dataLayer?.push({ event: 'site_page_view', ...parameters })
  } else if (analyticsConfig.gaId !== null) {
    window.gtag?.('event', 'page_view', parameters)
  }
  lastPagePath = pagePath
  return true
}

/** Wires the custom history event and popstate-aware location hook into analytics. */
export function useAnalytics(): void {
  const location = useLocation()
  const consent = useAnalyticsConsent()
  const pathname = pathForAnalytics(location)

  useEffect(() => {
    if (consent !== 'granted') {
      if (initialized) {
        window.gtag?.('consent', 'update', consentState('denied'))
        window.location.reload()
      }
      return
    }
    initializeAnalytics()
    trackPageView(pathname)
  }, [consent, pathname])
}

/** Test-only reset; no production caller should need to reset an analytics queue. */
export function resetAnalyticsForTests(): void {
  memoryConsent = null
  initialized = false
  lastPagePath = null
  delete window.gtag
  delete window.dataLayer
  document.getElementById(GTM_SCRIPT_ID)?.remove()
  document.getElementById(GA_SCRIPT_ID)?.remove()
}
