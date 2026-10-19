import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { useLang, type Lang } from '@/app/lang'
import { Link } from '@/app/Link'
import { useLocation } from '@/app/router'
import { paths } from '@/app/site'
import { ArrowRightIcon, BoltIcon, ClockIcon, MedalIcon, PlayIcon, ShieldIcon } from '@/components/icons'
import { CATEGORIES, GAMES, gameById, gamesInCategory, type CategoryId } from '@/sites/games'
import { GameCard } from './GameCard'
import { categoryHref, parseCategoryFilter, type CategoryFilter } from './portalParams'
import { TopPlayers } from './TopPlayers'
import { useAccount } from '@/features/account/queries'
import { AdSlot } from '@/components/ads/AdSlot'
import { PORTAL_COPY as COPY } from './portalCopy'
import { usePrefersReducedMotion } from '@/lib/motion'

const FEATURED = gameById('trap-the-orb')

const PERKS = [
  { icon: BoltIcon, ...COPY.perks.instant },
  { icon: ShieldIcon, ...COPY.perks.fair },
  { icon: MedalIcon, ...COPY.perks.records },
] as const

const HERO_STARS = [
  [8, 18, -1.4, 8],
  [16, 38, -4.5, 11],
  [24, 12, -6.2, 10],
  [31, 27, -2.8, 13],
  [42, 9, -8.4, 12],
  [53, 22, -5.3, 9],
  [63, 14, -7.1, 12],
  [71, 35, -3.4, 14],
  [82, 17, -6.8, 10],
  [91, 29, -1.8, 11],
  [12, 58, -9.2, 13],
  [29, 68, -4.1, 12],
  [48, 56, -6.4, 15],
  [67, 64, -2.1, 10],
  [87, 58, -7.7, 14],
] as const

function SectionHeading({
  id,
  eyebrow,
  children,
  aside,
}: {
  readonly id: string
  readonly eyebrow: string
  readonly children: ReactNode
  readonly aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <p className="text-[0.68rem] font-bold tracking-[0.16em] text-accent uppercase">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-[1.5rem] font-extrabold tracking-[-0.025em] text-ink sm:text-[1.7rem]">
          {children}
        </h2>
      </div>
      {aside}
    </div>
  )
}

function CategoryChips({ current, lang }: { readonly current: CategoryFilter; readonly lang: Lang }) {
  const chip = (filter: CategoryFilter, label: string, count: number) => {
    const isActive = filter === current
    return (
      <li key={filter}>
        <Link
          href={categoryHref(filter)}
          replace
          aria-current={isActive ? 'true' : undefined}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.84rem] font-semibold whitespace-nowrap transition duration-200 ${
            isActive ? 'bg-action text-on-action shadow-lift' : 'bg-sunken text-muted ring-1 ring-line hover:bg-sunken hover:text-ink'
          }`}
        >
          {label}
          <span className={`tabular text-[0.72rem] ${isActive ? 'text-on-action/70' : 'text-muted'}`}>{count}</span>
        </Link>
      </li>
    )
  }

  return (
    <ul aria-label={COPY.library.categories[lang]} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
      {chip('all', COPY.library.allGames[lang], GAMES.length)}
      {CATEGORIES.map((category) => chip(category.id, lang === 'tr' ? category.tr.name : category.name, gamesInCategory(category.id).length))}
    </ul>
  )
}

function EmptyCategory({ category, lang }: { readonly category: CategoryId; readonly lang: Lang }) {
  const info = CATEGORIES.find((candidate) => candidate.id === category)
  const name = (lang === 'tr' ? info?.tr.name : info?.name) ?? ''
  const blurb = (lang === 'tr' ? info?.tr.blurb : info?.blurb) ?? ''
  return (
    <div className="col-span-full rounded-[18px] border border-line bg-sunken px-6 py-10 text-center">
      <p className="text-[1.05rem] font-bold text-ink">{COPY.empty.title(name)[lang]}</p>
      <p className="mx-auto mt-1.5 max-w-[40ch] text-[0.88rem] text-muted">{COPY.empty.text(blurb, FEATURED.name)[lang]}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <Link
          href={paths.game(FEATURED.id)}
          className="inline-flex h-10 items-center gap-2 rounded-(--radius-control) bg-coral-600 px-4 text-[0.88rem] font-bold text-white shadow-coral transition hover:bg-coral-700"
        >
          <PlayIcon className="size-4" /> {COPY.empty.play(FEATURED.name)[lang]}
        </Link>
        <Link
          href={categoryHref('all')}
          replace
          className="inline-flex h-10 items-center rounded-(--radius-control) px-4 text-[0.88rem] font-semibold text-muted ring-1 ring-line transition hover:bg-sunken hover:text-ink"
        >
          {COPY.empty.showAll[lang]}
        </Link>
      </div>
    </div>
  )
}

/** The portal's front page: the featured game, every game by category and this week's top players. */
/** Where the first card sits when the page opens: in front, just right of centre. */
const ORBIT_START = 60
const ORBIT_STEP_MS = 6000

/**
 * The featured games take turns at the front: a short swing every few seconds,
 * holding still while the pointer or focus is on them, and not at all for
 * anyone who asks for less motion.
 */
function FeaturedOrbit({ lang }: { readonly lang: Lang }) {
  const games = GAMES.slice(0, 5)
  const step = 360 / games.length
  const [turn, setTurn] = useState(0)
  const [isHeld, setIsHeld] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (isHeld || reducedMotion) return
    const timer = window.setInterval(() => setTurn((current) => current + 1), ORBIT_STEP_MS)
    return () => window.clearInterval(timer)
  }, [isHeld, reducedMotion])

  return (
    <div
      className="portal-hero-orbit-stage is-orbiting"
      aria-label={COPY.hero.featuredGames[lang]}
      style={{ '--orbit-turn': `${ORBIT_START + turn * step}deg` } as CSSProperties}
      onPointerEnter={() => setIsHeld(true)}
      onPointerLeave={() => setIsHeld(false)}
      onFocus={() => setIsHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsHeld(false)
      }}
    >
      {games.map((game, index) => (
        <div key={game.id} className="portal-hero-game-item" style={{ '--orbit-angle': `${step * index}deg` } as CSSProperties}>
          <GameCard game={game} isFeatured={index === 0} delayMs={index * 100} />
        </div>
      ))}
    </div>
  )
}

export function PortalHome() {
  const location = useLocation()
  const filter = parseCategoryFilter(location.split('?')[1]?.split('#')[0] ?? '')
  const games = filter === 'all' ? GAMES : gamesInCategory(filter)
  const account = useAccount()
  const heroTitleId = useId()
  const lang = useLang()

  return (
    <div className="flex-1 bg-page text-ink">
      <section aria-labelledby={heroTitleId} className="portal-hero relative isolate min-h-[min(920px,100svh)] overflow-hidden bg-[#071225] text-white">
        <img src="/portal/portal-hero-v1.png" alt="" aria-hidden="true" className="portal-hero-image absolute inset-0 size-full object-cover" />
        <div aria-hidden="true" className="portal-hero-shade absolute inset-0" />
        <div aria-hidden="true" className="portal-hero-grid absolute inset-0" />
        <div aria-hidden="true" className="portal-hero-orbit portal-hero-orbit-one" />
        <div aria-hidden="true" className="portal-hero-orbit portal-hero-orbit-two" />
        <div aria-hidden="true" className="portal-hero-stars">
          {HERO_STARS.map(([left, top, delay, duration], index) => (
            <span
              key={index}
              className="portal-hero-star"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                '--star-delay': `${delay}s`,
                '--star-duration': `${duration}s`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div aria-hidden="true" className="portal-hero-spark portal-hero-spark-one" />
        <div aria-hidden="true" className="portal-hero-spark portal-hero-spark-two" />
        <div className="relative z-10 mx-auto flex min-h-[min(920px,100svh)] max-w-[1280px] flex-col items-center px-4 pt-32 pb-10 text-center sm:px-6 lg:pt-36">
          <div className="max-w-[680px] animate-rise motion-reduce:animate-none">
            <p className="inline-flex items-center gap-2 text-[0.64rem] font-bold tracking-[0.25em] text-white/70 uppercase"><span aria-hidden="true" className="size-1.5 rounded-full bg-teal-300 shadow-[0_0_16px_#7fd9d0]" /> {COPY.hero.eyebrow[lang]}</p>
            <h1 id={heroTitleId} className="mt-5 text-[2.8rem] leading-[0.98] font-extrabold tracking-[-0.055em] text-white sm:text-[5rem]">
              <span className="block">{COPY.hero.lineOne[lang]}</span>
              <span className="block bg-gradient-to-r from-teal-200 via-white to-violet-200 bg-clip-text text-transparent">{COPY.hero.lineTwo[lang]}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[46ch] text-[0.94rem] leading-relaxed text-white/68 sm:text-[1rem]">{COPY.hero.intro[lang]}</p>
          </div>

          <div className="portal-hero-featured animate-float mt-10 w-full max-w-[560px] sm:mt-12">
            <div className="mb-3 flex items-center justify-between px-1 text-left text-[0.62rem] font-bold tracking-[0.2em] text-white/58 uppercase">
              <span>{COPY.hero.featured[lang]}</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-1.5 rounded-full bg-coral-400" /> 01 / {GAMES.length.toString().padStart(2, '0')}</span>
            </div>
            {GAMES.length === 1 ? (
              <GameCard game={FEATURED} isFeatured delayMs={120} />
            ) : (
              <FeaturedOrbit lang={lang} />
            )}
          </div>

          <div className="mt-auto w-full max-w-[720px] pt-10">
            <ul className="grid grid-cols-3 gap-2 border-t border-white/15 pt-4 text-left sm:gap-8">
              {PERKS.map(({ icon: Icon, title }, index) => (
                <li key={title.en} className="flex items-center gap-2 text-[0.65rem] font-semibold text-white/62 sm:gap-2.5 sm:text-[0.72rem]">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-teal-200"><Icon className="size-3.5" /></span>
                  <span><span className="block text-white/90">0{index + 1}</span>{title[lang]}</span>
                </li>
              ))}
            </ul>
            <Link href="/#games" className="mt-7 inline-flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.18em] text-white/60 uppercase transition hover:text-white">{COPY.hero.scroll[lang]} <ArrowRightIcon className="size-3.5 rotate-90" /></Link>
          </div>
        </div>
      </section>

      {/* Games */}
      <section id="games" aria-labelledby="games-title" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <SectionHeading id="games-title" eyebrow={COPY.library.eyebrow[lang]}>
            {COPY.library.title[lang]}
          </SectionHeading>
          <div id="categories" className="mt-6 scroll-mt-24">
            <CategoryChips current={filter} lang={lang} />
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game, index) => (
              <li key={game.id}>
                <GameCard game={game} delayMs={index * 60} />
              </li>
            ))}
            {games.length === 0 && filter !== 'all' && (
              <li className="col-span-full">
                <EmptyCategory category={filter} lang={lang} />
              </li>
            )}
            {filter === 'all' && (
              <>
                <li>
                  <Link href={paths.play(FEATURED.id, 'daily')} className="daily-card group">
                    <ClockIcon className="size-7 text-reward" />
                    <span className="mt-auto pt-8 text-[0.65rem] font-bold tracking-[0.16em] text-reward uppercase">{COPY.daily.eyebrow[lang]}</span>
                    <h3 className="mt-2 text-xl font-extrabold tracking-tight">{COPY.daily.title[lang]}</h3>
                    <p className="mt-2 max-w-[30ch] text-sm leading-relaxed text-muted">{COPY.daily.text[lang]}</p>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-reward">{COPY.daily.cta[lang]} <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" /></span>
                  </Link>
                </li>
                <li className="flex flex-col justify-center rounded-[18px] border border-dashed border-line px-6 py-8">
                  <span className="text-[0.65rem] font-bold tracking-[0.16em] text-purple uppercase">{COPY.more.eyebrow[lang]}</span>
                  <h3 className="mt-3 text-xl font-extrabold tracking-tight">{COPY.more.titleOne[lang]}<br />{COPY.more.titleTwo[lang]}</h3>
                  <p className="mt-3 max-w-[29ch] text-sm leading-relaxed text-muted">{COPY.more.text[lang]}</p>
                  <span className="mt-6 text-xs text-muted">{COPY.more.genres[lang]}</span>
                </li>
              </>
            )}
          </ul>
        </div>
      </section>

      {/* Community */}
      <div className="border-t border-line">
        <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_336px] lg:px-8 lg:py-16">
          <TopPlayers />
          <div className="space-y-6">
            <div className="rounded-[18px] bg-gradient-to-br from-violet-600/40 to-teal-600/30 p-5 ring-1 ring-line">
              <p className="text-[0.68rem] font-bold tracking-[0.16em] text-muted uppercase">{COPY.account.eyebrow[lang]}</p>
              <p className="mt-1.5 text-[1.05rem] font-extrabold tracking-[-0.01em] text-ink">{COPY.account.title[lang]}</p>
              <p className="mt-1.5 text-[0.84rem] leading-relaxed text-muted">{COPY.account.text[lang]}</p>
              <Link
                href={account.status === 'signedIn' ? paths.profile() : '#account'}
                className="mt-4 inline-flex h-10 items-center rounded-(--radius-control) bg-action px-4 text-[0.86rem] font-bold text-on-action transition hover:opacity-90"
              >
                {account.status === 'signedIn' ? COPY.account.profile[lang] : COPY.account.signIn[lang]}
              </Link>
            </div>
            <AdSlot />
          </div>
        </div>
      </div>
    </div>
  )
}
