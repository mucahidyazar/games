import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { CHROME } from '@/app/copy'
import { t, useLang, type Localized } from '@/app/lang'
import type { DialogId } from '@/app/navigation'
import { navigate, useRoute } from '@/app/router'
import { gameById } from '@/sites/games'
import { routeGame } from '@/sites/routes'
import { paths } from '@/app/site'
import { useDocumentTitle } from '@/app/useDocumentTitle'
import { useHashDialog } from '@/app/useHashDialog'
import { useSectionScroll } from '@/app/useSectionScroll'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { AnalyticsConsentBanner, AnalyticsConsentPanel } from '@/components/privacy/AnalyticsConsent'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import { Dialog } from '@/components/ui/Dialog'
import { NotFoundPage } from '@/features/site/NotFoundPage'
import { GameScreen } from '@/games/trap-the-orb/components/GameScreen'
import { GAME_ID } from '@/games/trap-the-orb/game'
import { usePlayerData } from '@/games/trap-the-orb/state/playerDataContext'
import { logger } from '@/lib/logger'
import { useAnalytics } from '@/lib/analytics'

const HowToPlayContent = lazy(() =>
  import('@/games/trap-the-orb/content/HowToPlayContent').then((m) => ({ default: m.HowToPlayContent })),
)
const TrolleyHowToPlay = lazy(() =>
  import('@/games/absurd-trolley-problems/content/HowToPlayContent').then((m) => ({ default: m.HowToPlayContent })),
)
const TrolleyGame = lazy(() =>
  import('@/games/absurd-trolley-problems/components/TrolleyGame').then((m) => ({ default: m.TrolleyGame })),
)
const AboutPage = lazy(() => import('@/features/site/AboutPage').then((m) => ({ default: m.AboutPage })))
const PrivacyContent = lazy(() =>
  // Wrapped: the policy's own optional props don't overlap with the dialog's.
  import('@/features/site/content/PrivacyContent').then((m) => ({ default: () => <m.PrivacyContent /> })),
)
const AccountDialogContent = lazy(() =>
  import('@/features/account/AccountDialogContent').then((m) => ({ default: m.AccountDialogContent })),
)
const PortalHome = lazy(() => import('@/features/portal/PortalHome').then((m) => ({ default: m.PortalHome })))
const LeaderboardsPage = lazy(() =>
  import('@/games/trap-the-orb/leaderboards/LeaderboardsPage').then((m) => ({ default: m.LeaderboardsPage })),
)
const ProfilePage = lazy(() => import('@/features/account/ProfilePage').then((m) => ({ default: m.ProfilePage })))

type DialogContentProps = {
  readonly onClose: () => void
}

type DialogDefinition = {
  readonly title: Localized
  readonly description?: Localized
  readonly isProse: boolean
  readonly Content: ComponentType<DialogContentProps>
  /** Content that follows the site language; the rest is English only for now. */
  readonly isLocalized?: boolean
}

const en = (text: string): Localized => t(text, text)

const DIALOGS: Readonly<Record<DialogId, DialogDefinition>> = {
  'how-to-play': {
    title: en('How to play'),
    description: en('Trap the orbs, claim the space.'),
    isProse: true,
    Content: HowToPlayContent,
  },
  privacy: { title: en('Privacy policy'), isProse: true, Content: PrivacyContent },
  'privacy-settings': {
    title: t('Gizlilik ayarları', 'Privacy settings'),
    description: t('Hangi isteğe bağlı ölçümlerin çalışabileceğini seç.', 'Choose what optional measurement may run.'),
    isProse: true,
    Content: AnalyticsConsentPanel,
    isLocalized: true,
  },
  account: {
    title: en('Your account'),
    description: en('Rank your scores, keep records, earn badges.'),
    isProse: false,
    Content: AccountDialogContent,
  },
}

/** "How to play" belongs to whichever game is open. */
const TROLLEY_HOW_TO_PLAY: DialogDefinition = {
  title: t('Nasıl oynanır', 'How to play'),
  description: t('Kolu çek. Ya da çekme.', 'Pull the lever. Or don’t.'),
  isProse: true,
  Content: TrolleyHowToPlay,
  isLocalized: true,
}

function Loading({ label }: { readonly label: string }) {
  return <p className="py-10 text-center text-muted">{label}</p>
}

/** Shown when a lazily loaded part can't load — usually a stale tab after a new release. */
function LoadError() {
  return (
    <div className="py-8 text-center">
      <p className="text-[0.9rem] text-muted">This section couldn’t be loaded.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 text-[0.85rem] font-semibold text-teal-700 underline-offset-4 hover:underline"
      >
        Reload the page
      </button>
    </div>
  )
}

export default function App() {
  const { active, open, close } = useHashDialog()
  const { store, settings } = usePlayerData()
  const route = useRoute()
  const lang = useLang()
  const isTrolley = route.page === 'play' && route.game === 'absurd-trolley-problems'
  // A game with its own header draws it into this slot; every other page gets the shared one.
  const hasCustomHeader = route.page === 'play' && gameById(route.game).hasCustomHeader
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)
  const dialog = active ? (active === 'how-to-play' && routeGame(route) === 'absurd-trolley-problems' ? TROLLEY_HOW_TO_PLAY : DIALOGS[active]) : null
  const isHome = route.page === 'home'
  const isPlaying = route.page === 'play'
  const isPlayingOrb = isPlaying && route.game === GAME_ID
  const routeMode = route.page === 'play' ? route.mode : null
  // Once opened, the trolley game stays mounted (hidden) so its 3D scene isn't rebuilt on every visit.
  const [hasOpenedTrolley, setHasOpenedTrolley] = useState(isTrolley)
  if (isTrolley && !hasOpenedTrolley) setHasOpenedTrolley(true)
  useDocumentTitle(route)
  useSectionScroll()
  useAnalytics()

  // The game opens with the last mode picked in the URL.
  useEffect(() => {
    if (routeMode) store.setLastMode(routeMode)
  }, [routeMode, store])

  // Old links to the leaderboard dialog now open the leaderboards page.
  useEffect(() => {
    if (window.location.hash === '#about') navigate(paths.about(), { replace: true })
    if (window.location.hash === '#leaderboard') navigate(paths.leaderboards(GAME_ID), { replace: true })
  }, [])

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-action px-4 py-2 font-semibold text-on-action focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {CHROME.header.skip[lang]}
      </a>
      {hasCustomHeader ? (
        <header ref={setHeaderSlot} className="relative z-40 shrink-0" />
      ) : (
        <SiteHeader
          route={route}
          isSticky={!isPlaying}
          showSound={isPlaying}
          isSoundEnabled={settings.soundEnabled}
          onToggleSound={() => store.setSoundEnabled(!settings.soundEnabled)}
        />
      )}
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {isHome && (
          <ErrorBoundary fallback={() => <LoadError />} onError={(error) => logger.error('The home page failed to render', error)}>
            <Suspense fallback={<Loading label="Loading…" />}>
              <PortalHome />
            </Suspense>
          </ErrorBoundary>
        )}
        <div
          hidden={isHome}
          className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-4 pb-8 sm:px-6 lg:px-8 lg:pt-5"
        >
          {/* The game stays mounted on every page so a run survives a look at the leaderboards. */}
          <div lang="en">
            <GameScreen mode={routeMode ?? settings.lastMode} isActive={isPlayingOrb} isDialogOpen={active !== null} onOpenDialog={open} />
          </div>
          {hasOpenedTrolley && (
            <div hidden={!isTrolley}>
              <ErrorBoundary fallback={() => <LoadError />} onError={(error) => logger.error('Absurd Trolley Problems failed to render', error)}>
                <Suspense fallback={<Loading label="Loading…" />}>
                  <TrolleyGame
                    headerSlot={isTrolley ? headerSlot : null}
                    isActive={isTrolley}
                    isDialogOpen={active !== null}
                    soundEnabled={settings.soundEnabled}
                    onToggleSound={() => store.setSoundEnabled(!settings.soundEnabled)}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}
          {!isHome && !isPlaying && (
            <ErrorBoundary
              fallback={() => <LoadError />}
              onError={(error) => logger.error(`Page "${route.page}" failed to render`, error)}
            >
              <Suspense fallback={<Loading label="Loading…" />}>
                <div lang="en">
                  {route.page === 'leaderboards' && <LeaderboardsPage />}
                  {route.page === 'profile' && <ProfilePage />}
                  {route.page === 'about' && <AboutPage />}
                  {route.page === 'notFound' && <NotFoundPage />}
                </div>
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
      </main>
      <SiteFooter route={route} onOpenPrivacySettings={() => open('privacy-settings')} />

      <AnalyticsConsentBanner onOpenSettings={() => open('privacy-settings')} />

      <Dialog isOpen={dialog !== null} title={dialog?.title[lang] ?? ''} description={dialog?.description?.[lang]} onClose={close}>
        {dialog && (
          <ErrorBoundary
            fallback={() => <LoadError />}
            onError={(error) => logger.error(`Dialog "${active}" failed to render`, error)}
          >
            <Suspense fallback={<Loading label="Loading…" />}>
              <div className={dialog.isProse ? 'prose-dialog' : undefined} lang={dialog.isLocalized ? undefined : 'en'}>
                <dialog.Content onClose={close} />
              </div>
            </Suspense>
          </ErrorBoundary>
        )}
      </Dialog>
    </div>
  )
}
