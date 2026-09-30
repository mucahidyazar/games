import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.doUnmock('@/lib/site')
  document.getElementById('adsbygoogle-js')?.remove()
  delete window.adsbygoogle
})

async function renderAdSlot(adsense: { client: string | null; sidebarSlot: string | null }) {
  vi.doMock('@/lib/site', () => ({ siteConfig: { adsense, contactEmail: 'hello@example.com', url: 'https://games.mucahid.dev' } }))
  const { AdSlot } = await import('./AdSlot')
  return render(<AdSlot />)
}

describe('AdSlot', () => {
  it('shows a labelled email inquiry until AdSense is configured', async () => {
    await renderAdSlot({ client: null, sidebarSlot: null })

    expect(screen.getByRole('complementary', { name: 'Advertisement' })).toHaveTextContent('Advertise here')
    const href = new URL(screen.getByRole('link', { name: /^Advertise here/ }).getAttribute('href')!)
    expect(href.protocol).toBe('mailto:')
    expect(href.pathname).toBe('hello@example.com')
    expect(href.searchParams.get('subject')).toContain('games.mucahid.dev')
    expect(href.searchParams.get('body')).toContain('https://games.mucahid.dev')
    expect(document.getElementById('adsbygoogle-js')).toBeNull()
  })

  it('keeps the email inquiry visible in production while AdSense is off', async () => {
    vi.stubEnv('DEV', false)

    await renderAdSlot({ client: null, sidebarSlot: null })

    expect(screen.getByRole('link', { name: /^Advertise here/ })).toBeVisible()
    expect(document.querySelector('ins.adsbygoogle')).toBeNull()
    expect(document.getElementById('adsbygoogle-js')).toBeNull()
  })

  it('renders a real AdSense unit and loads the script once when configured', async () => {
    vi.stubEnv('VITE_ADSENSE_ENABLED', 'true')
    const { container } = await renderAdSlot({ client: 'ca-pub-1234567890123456', sidebarSlot: '9876543210' })

    const unit = container.querySelector('ins.adsbygoogle')
    expect(unit).toHaveAttribute('data-ad-client', 'ca-pub-1234567890123456')
    expect(unit).toHaveAttribute('data-ad-slot', '9876543210')
    expect(window.adsbygoogle).toHaveLength(1)

    const script = document.getElementById('adsbygoogle-js') as HTMLScriptElement | null
    expect(script?.src).toContain('client=ca-pub-1234567890123456')
    expect(document.querySelectorAll('#adsbygoogle-js')).toHaveLength(1)
  })

  it('keeps production ads off until the explicit enable gate is true', async () => {
    vi.stubEnv('DEV', false)
    await renderAdSlot({ client: 'ca-pub-1234567890123456', sidebarSlot: '9876543210' })

    expect(document.querySelector('ins.adsbygoogle')).toBeNull()
    expect(document.getElementById('adsbygoogle-js')).toBeNull()
  })
})
