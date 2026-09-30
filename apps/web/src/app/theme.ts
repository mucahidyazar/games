import { useSyncExternalStore } from 'react'

export type Theme = 'navy' | 'light'
export const THEME_STORAGE_KEY = 'games.theme'
export const THEME_CHANGE_EVENT = 'app:theme-change'
export const THEME_LABELS: Readonly<Record<Theme, string>> = { navy: 'Navy Dark', light: 'Light' }

export const parseTheme = (value: unknown): Theme => value === 'light' ? 'light' : 'navy'

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme === 'navy' ? 'dark' : 'light'
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'navy' ? '#0b1630' : '#f9fafc'
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

export function initializeTheme(): void {
  let theme: Theme = 'navy'
  try { theme = parseTheme(localStorage.getItem(THEME_STORAGE_KEY)) } catch { /* Storage can be unavailable in private browsing. */ }
  applyTheme(theme)
}

export function setTheme(theme: Theme): void {
  try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* The in-memory choice still works. */ }
  applyTheme(theme)
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) applyTheme(parseTheme(event.newValue))
  }
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => parseTheme(document.documentElement.dataset.theme), () => 'navy')
}
