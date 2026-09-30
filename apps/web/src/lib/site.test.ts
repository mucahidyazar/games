import { afterEach, describe, expect, it, vi } from 'vitest'
import { PORTAL, siteById } from '@/sites/sites'
import { parseSiteEnv as parse } from './site'

const TRAP_THE_ORB = siteById('traptheorb')
const parseSiteEnv = (env: Parameters<typeof parse>[0], site = TRAP_THE_ORB) => parse(env, site)

const VALID_CLIENT = 'ca-pub-1234567890123456'

describe('parseSiteEnv', () => {
  it('falls back to the defaults when nothing is configured', () => {
    expect(parseSiteEnv({})).toEqual({
      name: 'Trap The Orb',
      url: 'https://traptheorb.com',
      contactEmail: null,
      adsense: { client: null, sidebarSlot: null },
    })
    expect(parseSiteEnv({}, PORTAL)).toMatchObject({ name: 'games.mucahid.dev', url: 'https://games.mucahid.dev' })
  })

  it('treats empty and whitespace-only values as unset', () => {
    const config = parseSiteEnv({
      VITE_SITE_URL: '',
      VITE_CONTACT_EMAIL: '   ',
      VITE_ADSENSE_CLIENT: '',
      VITE_ADSENSE_SLOT_SIDEBAR: ' ',
    })

    expect(config.url).toBe(TRAP_THE_ORB.url)
    expect(config.contactEmail).toBeNull()
    expect(config.adsense).toEqual({ client: null, sidebarSlot: null })
  })

  it('removes trailing slashes from the site URL', () => {
    expect(parseSiteEnv({ VITE_SITE_URL: 'https://example.com/' }).url).toBe('https://example.com')
    expect(parseSiteEnv({ VITE_SITE_URL: ' https://example.com/games// ' }).url).toBe('https://example.com/games')
  })

  it('drops the query string and fragment from the site URL', () => {
    expect(parseSiteEnv({ VITE_SITE_URL: 'https://example.com/?ref=x#top' }).url).toBe('https://example.com')
  })

  it.each(['traptheorb.com', '/play', 'javascript:alert(1)', 'ftp://example.com', 'https://'])(
    'ignores the site URL %j because it is not an absolute http(s) URL',
    (value) => {
      expect(parseSiteEnv({ VITE_SITE_URL: value }).url).toBe(TRAP_THE_ORB.url)
    },
  )

  it('accepts a well-formed contact email', () => {
    expect(parseSiteEnv({ VITE_CONTACT_EMAIL: ' hello@traptheorb.com ' }).contactEmail).toBe('hello@traptheorb.com')
  })

  it.each([
    'hello',
    'hello@',
    '@traptheorb.com',
    'hello@traptheorb',
    'a b@traptheorb.com',
    'hi@traptheorb.com?subject=x',
  ])('rejects the malformed contact email %j', (value) => {
    expect(parseSiteEnv({ VITE_CONTACT_EMAIL: value }).contactEmail).toBeNull()
  })

  it('accepts a well-formed AdSense client and sidebar slot', () => {
    const config = parseSiteEnv({ VITE_ADSENSE_CLIENT: VALID_CLIENT, VITE_ADSENSE_SLOT_SIDEBAR: '1234567890' })

    expect(config.adsense).toEqual({ client: VALID_CLIENT, sidebarSlot: '1234567890' })
  })

  it('trims whitespace around AdSense ids before validating them', () => {
    const config = parseSiteEnv({ VITE_ADSENSE_CLIENT: ` ${VALID_CLIENT}\n`, VITE_ADSENSE_SLOT_SIDEBAR: ' 12345 ' })

    expect(config.adsense).toEqual({ client: VALID_CLIENT, sidebarSlot: '12345' })
  })

  it.each([
    'pub-1234567890123456',
    'ca-pub-123456789',
    'ca-pub-123456789012345678901',
    'ca-pub-12345678901234ab',
    'CA-PUB-1234567890123456',
    'ca-pub-1234567890123456; drop',
  ])('rejects the malformed AdSense client %j', (value) => {
    expect(parseSiteEnv({ VITE_ADSENSE_CLIENT: value }).adsense.client).toBeNull()
  })

  it.each(['1234', '123456789012345678901', '12a45', '-12345', '12 345'])(
    'rejects the malformed AdSense slot %j',
    (value) => {
      expect(parseSiteEnv({ VITE_ADSENSE_SLOT_SIDEBAR: value }).adsense.sidebarSlot).toBeNull()
    },
  )

  it('validates the client and the slot independently', () => {
    const config = parseSiteEnv({ VITE_ADSENSE_CLIENT: 'nope', VITE_ADSENSE_SLOT_SIDEBAR: '98765' })

    expect(config.adsense).toEqual({ client: null, sidebarSlot: '98765' })
  })

  it('returns a frozen config', () => {
    const config = parseSiteEnv({})

    expect(Object.isFrozen(config)).toBe(true)
    expect(Object.isFrozen(config.adsense)).toBe(true)
  })
})

describe('siteConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('is parsed from import.meta.env', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://staging.traptheorb.com/')
    vi.stubEnv('VITE_CONTACT_EMAIL', 'privacy@traptheorb.com')
    vi.stubEnv('VITE_ADSENSE_CLIENT', VALID_CLIENT)
    vi.stubEnv('VITE_ADSENSE_SLOT_SIDEBAR', '24680')
    vi.resetModules()

    const { siteConfig } = await import('./site')

    // Tests run on localhost, which resolves to the portal.
    expect(siteConfig).toEqual({
      name: 'games.mucahid.dev',
      url: 'https://staging.traptheorb.com',
      contactEmail: 'privacy@traptheorb.com',
      adsense: { client: VALID_CLIENT, sidebarSlot: '24680' },
    })
  })
})
