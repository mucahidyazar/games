import type { KeyboardEvent, ReactNode } from 'react'
import { CHROME } from '@/app/copy'
import { Link } from '@/app/Link'
import { paths } from '@/app/site'
import { VolumeOffIcon, VolumeOnIcon } from '@/components/icons'
import { LangToggle } from '@/components/layout/LangToggle'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { AccountButton } from '@/features/account/AccountButton'
import { UI } from '../content/strings'
import type { Lang } from '../content/types'
import { GAME_ID } from '../game'
import { BLOCK_FONT, MusicNote, Sparkle, Twinkle } from './pixel'
import { PixelText } from './PixelText'

export type TabId = 'play' | 'dilemmas' | 'community' | 'compare'
const TABS: readonly TabId[] = ['play', 'dilemmas', 'community', 'compare']

type TrolleyHeaderProps = {
  readonly lang: Lang
  readonly counter: { readonly current: number; readonly total: number }
  /** What the counter counts, for screen readers: dilemmas, or Foot's cases. */
  readonly counterLabel?: string
  readonly music: boolean
  readonly sound: boolean
  readonly onMusic: () => void
  readonly onSound: () => void
  /** The middle of the header, centred on the page: the game's tabs. */
  readonly children: ReactNode
}

type GameTabsProps = {
  readonly lang: Lang
  readonly tab: TabId
  readonly panelId: (tab: TabId) => string
  readonly tabId: (tab: TabId) => string
  readonly onTab: (tab: TabId) => void
  /** Other names for some tabs (Foot's cases are not "dilemmas"). */
  readonly labels?: Partial<Record<TabId, string>>
}

const pad = (value: number): string => value.toString().padStart(2, '0')

/** The game's four tabs. */
export function GameTabs({ lang, tab, panelId, tabId, onTab, labels }: GameTabsProps) {
  // Arrow keys move between tabs, as in any tab list.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const index = TABS.indexOf(tab)
    const next =
      event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    const target = TABS[next] as TabId
    onTab(target)
    document.getElementById(tabId(target))?.focus()
  }

  return (
    <div role="tablist" aria-label={UI.tabsLabel[lang]} className="atp-tabs" onKeyDown={onKeyDown}>
      {TABS.map((id) => (
        <button
          key={id}
          id={tabId(id)}
          type="button"
          role="tab"
          aria-selected={tab === id}
          aria-controls={panelId(id)}
          tabIndex={tab === id ? 0 : -1}
          className="atp-tab"
          onClick={() => onTab(id)}
        >
          {labels?.[id] ?? UI.tabs[id][lang]}
        </button>
      ))}
    </div>
  )
}

/**
 * The game's own site header: the way back to every game, the pixel logo,
 * what goes in the middle (centred on the page) and the game's and site's controls.
 */
export function TrolleyHeader({ lang, counter, counterLabel = UI.counterLabel[lang], music, sound, onMusic, onSound, children }: TrolleyHeaderProps) {
  return (
    <div className="atp-header" lang={lang}>
      <div className="atp-header-inner">
        <Link href={paths.home()} className="atp-back" aria-label={CHROME.nav.allGames[lang]}>
          <span aria-hidden="true" className="atp-back-arrow">
            ←
          </span>
          <span className="atp-back-label">{CHROME.nav.allGames[lang]}</span>
        </Link>

        <h1 className="atp-brand">
          <Link href={paths.game(GAME_ID)} className="atp-brand-link" aria-label="Absurd Trolley Problems">
            <Twinkle className="atp-brand-twinkle" />
            <span className="atp-brand-stack" aria-hidden="true">
              <PixelText className="atp-brand-top" text="ABSURD" family={BLOCK_FONT} weight={700} artSize={8} letterSpacing={1} fill={['#fdf8d8', '#9fedb9']} outline="#14463a" shadow="#040b18" trim singleLine />
              <PixelText className="atp-brand-bottom" text="TROLLEY PROBLEMS" family={BLOCK_FONT} weight={700} artSize={8} fill={['#c9f8df', '#7fe3b8']} outline="#0c2c2a" trim singleLine />
            </span>
            <Sparkle className="atp-brand-sparkle" />
          </Link>
        </h1>

        {children}

        <div className="atp-header-tools">
          <p className="atp-counter" aria-label={`${counterLabel} ${counter.current} / ${counter.total}`}>
            <span className="atp-counter-current">{pad(counter.current)}</span>
            <span aria-hidden="true"> / {pad(counter.total)}</span>
          </p>
          <LangToggle variant="pixel" />
          <button type="button" className="atp-icon-button" onClick={onMusic} aria-pressed={music} aria-label={UI.music[lang]} title={UI.music[lang]}>
            <MusicNote off={!music} />
          </button>
          <button
            type="button"
            className="atp-icon-button"
            onClick={onSound}
            aria-pressed={sound}
            aria-label={sound ? CHROME.header.muteSound[lang] : CHROME.header.unmuteSound[lang]}
            title={sound ? CHROME.header.soundOn[lang] : CHROME.header.soundOff[lang]}
          >
            {sound ? <VolumeOnIcon className="size-[17px]" /> : <VolumeOffIcon className="size-[17px]" />}
          </button>
          {/* With the switches, so on a phone the logo keeps the room beside the account button. */}
          <ThemeToggle variant="pixel" />
        </div>

        <div className="atp-header-account">
          <AccountButton variant="pixel" />
        </div>
      </div>
    </div>
  )
}
