import { useSyncExternalStore } from 'react'

/**
 * The site's language: Turkish or English. Stored per origin as `games.lang`
 * and reflected in <html lang>; with nothing stored, the browser's language
 * decides. Search metadata stays in English.
 */

export type Lang = 'tr' | 'en'

/** A piece of copy in every language the site speaks. */
export type Localized = Readonly<Record<Lang, string>>

export const LANGS: readonly Lang[] = ['tr', 'en']
export const LANG_STORAGE_KEY = 'games.lang'
export const LANG_CHANGE_EVENT = 'app:lang-change'

export const parseLang = (value: unknown): Lang | null => (value === 'tr' || value === 'en' ? value : null)

/** Turkish for browsers that ask for Turkish first, English for everyone else. */
export function detectLang(languages: readonly string[] | undefined): Lang {
  const first = languages?.find((tag) => tag.trim() !== '')
  return first?.toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

export const t = (tr: string, en: string): Localized => ({ tr, en })

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages?.length ? navigator.languages : [navigator.language]
}

function storedLang(): Lang | null {
  try {
    return parseLang(localStorage.getItem(LANG_STORAGE_KEY))
  } catch {
    // Storage can be unavailable in private browsing.
    return null
  }
}

function applyLang(lang: Lang): void {
  document.documentElement.lang = lang
  window.dispatchEvent(new Event(LANG_CHANGE_EVENT))
}

export function initializeLang(): void {
  applyLang(storedLang() ?? detectLang(browserLanguages()))
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // The in-memory choice still works.
  }
  applyLang(lang)
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === LANG_STORAGE_KEY) applyLang(parseLang(event.newValue) ?? detectLang(browserLanguages()))
  }
  window.addEventListener(LANG_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(LANG_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, () => parseLang(document.documentElement.lang) ?? 'en', () => 'en')
}
