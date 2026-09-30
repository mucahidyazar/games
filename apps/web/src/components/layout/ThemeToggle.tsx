import { setTheme, THEME_LABELS, useTheme } from '@/app/theme'

export function ThemeToggle({ onDark = false }: { readonly onDark?: boolean }) {
  const theme = useTheme()
  const next = theme === 'navy' ? 'light' : 'navy'
  return (
    <button type="button" onClick={() => setTheme(next)} aria-label={`Switch to ${THEME_LABELS[next]} theme`} title={`Theme: ${THEME_LABELS[theme]}`} className={`grid size-9 shrink-0 place-items-center rounded-full opacity-80 transition hover:opacity-100 ${onDark ? 'text-white hover:bg-white/10' : 'text-[var(--chrome-fg)] hover:bg-[var(--chrome-border)]'}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[19px]">
        {theme === 'navy' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13.2A8.6 8.6 0 0 1 10.8 3.5a8.6 8.6 0 1 0 9.7 9.7Z" />}
      </svg>
    </button>
  )
}
