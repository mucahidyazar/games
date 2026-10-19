import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectLang, initializeLang, LANG_STORAGE_KEY, parseLang, setLang, t, useLang } from './lang'

afterEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  vi.restoreAllMocks()
})

describe('detectLang', () => {
  it('speaks Turkish to browsers that ask for it first', () => {
    expect(detectLang(['tr-TR', 'en-US'])).toBe('tr')
    expect(detectLang(['TR'])).toBe('tr')
  })

  it('falls back to English for everyone else', () => {
    expect(detectLang(['en-GB', 'tr'])).toBe('en')
    expect(detectLang(['de-DE'])).toBe('en')
    expect(detectLang([])).toBe('en')
    expect(detectLang(undefined)).toBe('en')
    expect(detectLang(['', ' '])).toBe('en')
  })
})

describe('the language setting', () => {
  it('parses only known languages', () => {
    expect(parseLang('tr')).toBe('tr')
    expect(parseLang('en')).toBe('en')
    expect(parseLang('de')).toBeNull()
    expect(parseLang(null)).toBeNull()
  })

  it('builds localized copy', () => {
    expect(t('Merhaba', 'Hello')).toEqual({ tr: 'Merhaba', en: 'Hello' })
  })

  it('starts from the stored choice, then the browser language', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'tr')
    initializeLang()
    expect(document.documentElement.lang).toBe('tr')

    localStorage.removeItem(LANG_STORAGE_KEY)
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['tr-TR'])
    initializeLang()
    expect(document.documentElement.lang).toBe('tr')
  })

  it('stores a choice, updates <html lang> and re-renders subscribers', () => {
    const { result } = renderHook(() => useLang())
    expect(result.current).toBe('en')
    act(() => setLang('tr'))
    expect(result.current).toBe('tr')
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('tr')
    expect(document.documentElement.lang).toBe('tr')
  })

  it('follows a choice made in another tab', () => {
    const { result } = renderHook(() => useLang())
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: LANG_STORAGE_KEY, newValue: 'tr' }))
    })
    expect(result.current).toBe('tr')
  })

  it('keeps working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => initializeLang()).not.toThrow()
    expect(() => setLang('tr')).not.toThrow()
    expect(document.documentElement.lang).toBe('tr')
  })
})
