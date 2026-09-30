import { afterEach, describe, expect, it, vi } from 'vitest'
import { navigate, parseRoute } from './router'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('parseRoute', () => {
  it('knows every page', () => {
    expect(parseRoute('/')).toEqual({ page: 'home' })
    expect(parseRoute('/trap-the-orb/play/hardcore')).toEqual({ page: 'play', game: 'trap-the-orb', mode: 'hardcore' })
    expect(parseRoute('/trap-the-orb/leaderboards/')).toEqual({ page: 'leaderboards', game: 'trap-the-orb' })
    expect(parseRoute('/about')).toEqual({ page: 'about' })
    expect(parseRoute('/profile')).toEqual({ page: 'profile' })
  })

  it('treats everything else as not found', () => {
    expect(parseRoute('/trap-the-orb/play/turbo')).toEqual({ page: 'notFound' })
    expect(parseRoute('/trap-the-orb/play/zen/extra')).toEqual({ page: 'notFound' })
    expect(parseRoute('/nope')).toEqual({ page: 'notFound' })
  })
})

describe('navigate', () => {
  it('pushes a new entry and tells subscribers', () => {
    const listener = vi.fn()
    window.addEventListener('app:navigate', listener)

    navigate('/leaderboards?board=score.daily')
    navigate('/leaderboards?board=score.daily')

    expect(window.location.pathname + window.location.search).toBe('/leaderboards?board=score.daily')
    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener('app:navigate', listener)
  })

  it('keeps a section in the URL so it can be shared', async () => {
    const section = document.createElement('section')
    section.id = 'apps'
    section.scrollIntoView = vi.fn()
    document.body.append(section)

    navigate('/#apps')
    expect(window.location.hash).toBe('#apps')
    section.remove()
  })
})
