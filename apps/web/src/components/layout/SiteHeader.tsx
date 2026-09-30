import { useEffect, useId, useRef, useState } from 'react'
import { Link } from '@/app/Link'
import { navItemsFor, type NavItem } from '@/app/navigation'
import { NAVIGATE_EVENT } from '@/app/router'
import { paths, site } from '@/app/site'
import { ArrowUpRightIcon, CloseIcon, MenuIcon, VolumeOffIcon, VolumeOnIcon } from '@/components/icons'
import { AccountButton } from '@/features/account/AccountButton'
import { gameById } from '@/sites/games'
import { routeGame, type Route } from '@/sites/routes'
import { Brand } from './Brand'
import { ThemeToggle } from './ThemeToggle'

type SiteHeaderProps = {
  readonly route: Route
  /** Sticks to the top while scrolling (the portal pages; the game keeps its full height). */
  readonly isSticky: boolean
  /** The sound toggle only matters while a game is on screen. */
  readonly showSound: boolean
  readonly isSoundEnabled: boolean
  readonly onToggleSound: () => void
}

type NavLinkProps = {
  readonly item: NavItem
  readonly variant: 'bar' | 'menu'
  readonly onNavigate?: () => void
  readonly overlay?: boolean
}

function NavLink({ item, variant, onNavigate, overlay = false }: NavLinkProps) {
  const base =
    variant === 'bar'
      ? 'relative h-11 px-3 text-[0.82rem] tracking-[0.02em]'
      : 'h-11 w-full rounded-xl px-3.5 text-[0.95rem]'
  const tone = item.isActive
    ? overlay
      ? 'text-white'
      : 'text-[var(--chrome-fg)]'
    : overlay
      ? 'text-white/65 hover:text-white'
      : 'text-[var(--chrome-muted)] hover:text-[var(--chrome-fg)]'
  const external = item.isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {}

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={item.isActive ? 'page' : undefined}
      className={`inline-flex items-center gap-1.5 font-semibold whitespace-nowrap transition duration-200 ${base} ${tone}`}
      {...external}
    >
      {item.label}
      {item.isActive && variant === 'bar' && (
        <span aria-hidden="true" className="absolute right-3 bottom-0.5 left-3 h-px rounded-full bg-current opacity-80" />
      )}
      {item.badge && (
        <span className="rounded-full bg-coral-400/25 px-1.5 py-px text-[0.56rem] font-bold tracking-wide text-coral-200 uppercase">
          {item.badge}
        </span>
      )}
      {item.isExternal && <ArrowUpRightIcon className="size-3.5 opacity-70" />}
    </Link>
  )
}

/** On the portal: the game that is open, next to the site's brand. */
function GameCrumb({ route }: { readonly route: Route }) {
  const gameId = site.kind === 'game' ? site.game : routeGame(route)
  if (!gameId) return null
  const game = gameById(gameId)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="h-7 w-px shrink-0 bg-[var(--chrome-border)]" />
      <h1 className="sr-only">{game.name}</h1>
      <Link
        href={paths.game(gameId)}
        aria-label={`${game.name} — play`}
        title={game.name}
        className="group grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--chrome-border)] p-0.5 text-[var(--chrome-fg)] transition hover:scale-105 hover:opacity-85"
      >
        <img src={game.icon} alt="" width={32} height={32} className="size-full rounded-[9px]" />
      </Link>
      <span className="hidden max-w-[12ch] truncate text-[0.78rem] font-bold tracking-[-0.01em] text-[var(--chrome-fg)] sm:block">{game.name}</span>
    </div>
  )
}

/**
 * The shared header of every site: the brand on the left (the portal's name,
 * or the game's name on its own domain), the page's links, and the account.
 */
export function SiteHeader({ route, isSticky, showSound, isSoundEnabled, onToggleSound }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuId = useId()
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const isGameSurface = Boolean(routeGame(route))
  const items = navItemsFor(site, route, paths).filter((item) => !(isGameSurface && item.label === 'All games'))
  const isOverlay = route.page === 'home' && site.kind === 'portal'

  useEffect(() => {
    if (!isMenuOpen) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setIsMenuOpen(false)
      // The menu is about to be hidden; don't let focus fall back to <body>.
      menuButtonRef.current?.focus()
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isMenuOpen])

  // History navigation can happen outside the menu (including browser Back).
  useEffect(() => {
    const closeMenu = (): void => setIsMenuOpen(false)
    window.addEventListener(NAVIGATE_EVENT, closeMenu)
    window.addEventListener('popstate', closeMenu)
    window.addEventListener('hashchange', closeMenu)
    return () => {
      window.removeEventListener(NAVIGATE_EVENT, closeMenu)
      window.removeEventListener('popstate', closeMenu)
      window.removeEventListener('hashchange', closeMenu)
    }
  }, [])

  return (
    <header className={`${isOverlay ? 'absolute inset-x-0' : isSticky ? 'sticky' : 'relative'} top-0 z-40 shrink-0 ${isOverlay || isGameSurface ? 'bg-transparent text-[var(--chrome-fg)]' : 'border-b border-[var(--chrome-border)] bg-[var(--chrome-bg)] text-[var(--chrome-fg)] backdrop-blur-xl'}`}>
      {/* The sites' signature: a thin line running from the portal's violet to the game's teal. */}
      {!isOverlay && !isGameSurface && <div aria-hidden="true" className="h-0.5 bg-gradient-to-r from-violet-500 via-teal-400 to-violet-500" />}
      <div ref={menuRef} className={`relative mx-auto flex h-[5.25rem] max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8 ${isGameSurface ? 'py-1' : ''}`}>
        <div className="flex min-w-0 shrink-0 items-center gap-4">
          {isGameSurface ? (
            <>
              <Link href={paths.home()} aria-label={site.kind === 'portal' ? 'All games' : `${site.name} home`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-1.5 text-[0.72rem] font-bold text-[var(--chrome-muted)] transition hover:bg-[var(--chrome-border)] hover:text-[var(--chrome-fg)]">
                <span aria-hidden="true" className="text-base leading-none">←</span>
                <span className="hidden sm:inline">{site.kind === 'portal' ? 'All games' : 'Home'}</span>
              </Link>
              <GameCrumb route={route} />
            </>
          ) : (
            <Link
              href={paths.home()}
              aria-label={site.kind === 'portal' ? 'games.mucahid.dev — home' : `${site.name} — play now`}
              className="block rounded-lg"
            >
              <Brand asHeading={site.kind === 'game'} onDark={isOverlay} />
            </Link>
          )}
        </div>

        <nav aria-label="Main" className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 xl:block">
          <ul className="flex items-center gap-1.5">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} variant="bar" overlay={isOverlay} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {showSound && (
            <button
              type="button"
              onClick={onToggleSound}
              aria-pressed={isSoundEnabled}
              aria-label={isSoundEnabled ? 'Mute sound (M)' : 'Turn sound on (M)'}
              title={isSoundEnabled ? 'Sound on — press M to mute' : 'Sound off — press M to unmute'}
              className={`grid size-9 shrink-0 place-items-center rounded-full text-[var(--chrome-fg)] opacity-80 transition duration-200 hover:opacity-100 active:scale-95 ${isOverlay ? 'bg-white/10 text-white' : 'bg-[var(--chrome-border)]'}`}
            >
              {isSoundEnabled ? <VolumeOnIcon className="size-[18px]" /> : <VolumeOffIcon className="size-[18px]" />}
            </button>
          )}
          <ThemeToggle onDark={isOverlay} />
          <AccountButton />
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls={menuId}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            className={`grid size-10 shrink-0 place-items-center rounded-full opacity-80 transition hover:opacity-100 xl:hidden ${isOverlay ? 'text-white hover:bg-white/10' : 'text-[var(--chrome-fg)] hover:bg-[var(--chrome-border)]'}`}
          >
            {isMenuOpen ? <CloseIcon className="size-5" /> : <MenuIcon className="size-5" />}
          </button>
        </div>

        <nav
          id={menuId}
          aria-label="Main"
          hidden={!isMenuOpen}
          className={`absolute inset-x-0 top-full origin-top animate-pop px-3 pt-2 pb-3 shadow-lift xl:hidden ${isOverlay ? 'border-t border-white/10 bg-[#0b1630]/95 text-white backdrop-blur-xl' : 'border-t border-[var(--chrome-border)] bg-[var(--chrome-bg)]'}`}
        >
          <ul className="grid gap-0.5">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} variant="menu" onNavigate={() => setIsMenuOpen(false)} />
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
