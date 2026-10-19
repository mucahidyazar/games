import { CHROME } from '@/app/copy'
import { LANGS, setLang, useLang } from '@/app/lang'

type LangToggleProps = {
  /** Over the portal's dark hero image. */
  readonly onDark?: boolean
  /** The pixel-art styling a game's own header uses. */
  readonly variant?: 'chrome' | 'pixel'
}

/** TR | EN: switches the site's language. */
export function LangToggle({ onDark = false, variant = 'chrome' }: LangToggleProps) {
  const lang = useLang()
  if (variant === 'pixel') {
    return (
      <div className="atp-lang" role="group" aria-label={CHROME.header.language[lang]}>
        {LANGS.map((code) => (
          <button key={code} type="button" lang={code} aria-pressed={lang === code} className="atp-lang-button" onClick={() => setLang(code)}>
            {code.toUpperCase()}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div
      role="group"
      aria-label={CHROME.header.language[lang]}
      className={`inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full p-0.5 ring-1 ${onDark ? 'ring-white/15' : 'ring-[var(--chrome-border)]'}`}
    >
      {LANGS.map((code) => {
        const isActive = lang === code
        const tone = isActive
          ? onDark
            ? 'bg-white/15 text-white'
            : 'bg-[var(--chrome-border)] text-[var(--chrome-fg)]'
          : onDark
            ? 'text-white/60 hover:text-white'
            : 'text-[var(--chrome-muted)] hover:text-[var(--chrome-fg)]'
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={isActive}
            onClick={() => setLang(code)}
            className={`grid h-8 min-w-9 place-items-center rounded-full px-2 text-[0.7rem] font-bold tracking-[0.08em] transition ${tone}`}
          >
            {code.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
