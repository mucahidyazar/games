import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseAnalyticsEnv, pathForAnalytics, readAnalyticsConsent, setAnalyticsConsent, resetAnalyticsForTests } from './analytics'

afterEach(() => {
  resetAnalyticsForTests()
  window.localStorage.clear()
  document.getElementById('games-gtm-js')?.remove()
  document.getElementById('games-ga-js')?.remove()
  delete window.dataLayer
  delete window.gtag
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('parseAnalyticsEnv', () => {
  it('prefers GTM and never enables a second direct GA loader', () => {
    expect(parseAnalyticsEnv({ VITE_GTM_ID: ' GTM-Ab12 ', VITE_GA_ID: 'G-1234567890' })).toEqual({
      gtmId: 'GTM-Ab12',
      gaId: null,
    })
  })

  it('uses a direct GA4 id when GTM is absent', () => {
    expect(parseAnalyticsEnv({ VITE_GA_ID: ' G-1234567890 ' })).toEqual({ gtmId: null, gaId: 'G-1234567890' })
  })
})

describe('privacy-safe page tracking', () => {
  it('keeps only the pathname', () => {
    expect(pathForAnalytics('/profile?email=secret@example.com#replay')).toBe('/profile')
    expect(pathForAnalytics('leaderboards')).toBe('/leaderboards')
  })

  it('does not load Google or send a page view before consent', async () => {
    vi.stubEnv('VITE_GTM_ID', 'GTM-TEST123')
    vi.resetModules()
    const analytics = await import('./analytics')

    expect(readAnalyticsConsent()).toBeNull()
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull()
    expect(analytics.initializeAnalytics()).toBe(false)
    expect(analytics.trackPageView('/')).toBe(false)
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull()
  })

  it('loads GTM once and de-duplicates SPA views', async () => {
    vi.stubEnv('VITE_GTM_ID', 'GTM-TEST123')
    vi.resetModules()
    const analytics = await import('./analytics')
    analytics.setAnalyticsConsent('granted')
    analytics.initializeAnalytics()

    expect(document.querySelectorAll('#games-gtm-js')).toHaveLength(1)
    expect(document.querySelector('#games-ga-js')).toBeNull()
    expect(analytics.trackPageView('/trap-the-orb?board=secret#details')).toBe(true)
    expect(analytics.trackPageView('/trap-the-orb?another=secret')).toBe(false)
    expect(window.dataLayer).toContainEqual({ event: 'site_page_view', page_path: '/trap-the-orb', page_location: `${window.location.origin}/trap-the-orb`, page_referrer: '' })
  })

  it('falls back to direct GA4 without adding GTM', async () => {
    vi.stubEnv('VITE_GA_ID', 'G-TEST12345')
    vi.resetModules()
    const analytics = await import('./analytics')
    analytics.setAnalyticsConsent('granted')
    analytics.initializeAnalytics()
    analytics.trackPageView('/about')

    expect(document.querySelectorAll('#games-ga-js')).toHaveLength(1)
    expect(document.querySelector('#games-gtm-js')).toBeNull()
    expect(window.dataLayer?.some((entry) => typeof entry === 'object' && entry !== null && Reflect.get(entry, '0') === 'event' && Reflect.get(entry, '1') === 'page_view')).toBe(true)
  })

  it('persists and re-opens the choice on the same device', () => {
    expect(readAnalyticsConsent()).toBeNull()
    setAnalyticsConsent('denied')
    expect(readAnalyticsConsent()).toBe('denied')
    setAnalyticsConsent('granted')
    expect(readAnalyticsConsent()).toBe('granted')
  })
})
