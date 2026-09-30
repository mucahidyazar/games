import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTheme, parseTheme, setTheme, THEME_CHANGE_EVENT, THEME_STORAGE_KEY, useTheme } from './theme'

function ThemeProbe() {
  const theme = useTheme()
  return <output data-testid="theme">{theme}</output>
}

beforeEach(() => {
  document.documentElement.dataset.theme = ''
  document.documentElement.style.colorScheme = ''
  localStorage.clear()
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
  }
  meta.content = ''
})

afterEach(() => {
  vi.restoreAllMocks()
  document.documentElement.dataset.theme = ''
  document.documentElement.style.colorScheme = ''
})

describe('theme persistence', () => {
  it('parses only the supported light value and defaults to navy', () => {
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('navy')).toBe('navy')
    expect(parseTheme('system')).toBe('navy')
    expect(parseTheme(null)).toBe('navy')
  })

  it('initializes the persisted theme and applies the matching browser colors', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')

    initializeTheme()

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#f9fafc')
  })

  it('uses navy when there is no persisted theme', () => {
    initializeTheme()

    expect(document.documentElement.dataset.theme).toBe('navy')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#0b1630')
  })

  it('persists a new theme, updates the document and emits the theme event', () => {
    const listener = vi.fn()
    window.addEventListener(THEME_CHANGE_EVENT, listener)

    setTheme('light')

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(THEME_CHANGE_EVENT, listener)
  })

  it('keeps the in-memory choice when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    initializeTheme()
    setTheme('light')

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})

describe('useTheme', () => {
  it('reflects initialization and setTheme updates', () => {
    initializeTheme()
    render(<ThemeProbe />)
    expect(screen.getByTestId('theme')).toHaveTextContent('navy')

    act(() => setTheme('light'))

    expect(screen.getByTestId('theme')).toHaveTextContent('light')
  })

  it('syncs a theme selected in another tab through storage events', () => {
    initializeTheme()
    render(<ThemeProbe />)

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'light' }))
    })

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
  })
})
