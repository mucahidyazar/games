import { useId, type CSSProperties, type ReactNode } from 'react'
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

const FEATURED = gameById('trap-the-orb')

const PERKS = [
  { icon: BoltIcon, title: 'Instant play', text: 'No download, no sign-up. Open a game and you’re in.' },
  { icon: ShieldIcon, title: 'Fair leaderboards', text: 'Fixed rules, server-verified runs. No shortcuts to the top.' },
  { icon: MedalIcon, title: 'Records & badges', text: 'Sign in once and your progress follows you to every game.' },
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

function CategoryChips({ current }: { readonly current: CategoryFilter }) {
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
    <ul aria-label="Categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
      {chip('all', 'All games', GAMES.length)}
      {CATEGORIES.map((category) => chip(category.id, category.name, gamesInCategory(category.id).length))}
    </ul>
  )
}

function EmptyCategory({ category }: { readonly category: CategoryId }) {
  const info = CATEGORIES.find((candidate) => candidate.id === category)
  return (
    <div className="col-span-full rounded-[18px] border border-line bg-sunken px-6 py-10 text-center">
      <p className="text-[1.05rem] font-bold text-ink">No {info?.name.toLowerCase()} games yet</p>
      <p className="mx-auto mt-1.5 max-w-[40ch] text-[0.88rem] text-muted">
        {info?.blurb} Explore another category or try {FEATURED.name}.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <Link
          href={paths.game(FEATURED.id)}
          className="inline-flex h-10 items-center gap-2 rounded-(--radius-control) bg-coral-600 px-4 text-[0.88rem] font-bold text-white shadow-coral transition hover:bg-coral-700"
        >
          <PlayIcon className="size-4" /> Play {FEATURED.name}
        </Link>
        <Link
          href={categoryHref('all')}
          replace
          className="inline-flex h-10 items-center rounded-(--radius-control) px-4 text-[0.88rem] font-semibold text-muted ring-1 ring-line transition hover:bg-sunken hover:text-ink"
        >
          Show all games
        </Link>
      </div>
    </div>
  )
}

/** The portal's front page: the featured game, every game by category and this week's top players. */
export function PortalHome() {
  const location = useLocation()
  const filter = parseCategoryFilter(location.split('?')[1]?.split('#')[0] ?? '')
  const games = filter === 'all' ? GAMES : gamesInCategory(filter)
  const account = useAccount()
  const heroTitleId = useId()

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
            <p className="inline-flex items-center gap-2 text-[0.64rem] font-bold tracking-[0.25em] text-white/70 uppercase"><span aria-hidden="true" className="size-1.5 rounded-full bg-teal-300 shadow-[0_0_16px_#7fd9d0]" /> The arcade is open</p>
            <h1 id={heroTitleId} className="mt-5 text-[2.8rem] leading-[0.98] font-extrabold tracking-[-0.055em] text-white sm:text-[5rem]">
              <span className="block">Play in seconds.</span>
              <span className="block bg-gradient-to-r from-teal-200 via-white to-violet-200 bg-clip-text text-transparent">Make it count.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[46ch] text-[0.94rem] leading-relaxed text-white/68 sm:text-[1rem]">Small, sharp games built by Mucahid. Pick a game below and jump straight in — no download, no sign-up.</p>
          </div>

          <div className="portal-hero-featured animate-float mt-10 w-full max-w-[560px] sm:mt-12">
            <div className="mb-3 flex items-center justify-between px-1 text-left text-[0.62rem] font-bold tracking-[0.2em] text-white/58 uppercase">
              <span>Featured drop</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-1.5 rounded-full bg-coral-400" /> 01 / {GAMES.length.toString().padStart(2, '0')}</span>
            </div>
            {GAMES.length === 1 ? (
              <GameCard game={FEATURED} isFeatured delayMs={120} />
            ) : (
              <div className="portal-hero-orbit-stage is-orbiting" aria-label="Featured games">
                {GAMES.slice(0, 5).map((game, index) => (
                  <div
                    key={game.id}
                    className="portal-hero-game-item"
                    style={{
                      '--orbit-angle': `${(360 / Math.min(GAMES.length, 5)) * index}deg`,
                      '--orbit-delay': `${index * -2.5}s`,
                    } as CSSProperties}
                  >
                    <GameCard game={game} isFeatured={index === 0} delayMs={index * 100} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-auto w-full max-w-[720px] pt-10">
            <ul className="grid grid-cols-3 gap-2 border-t border-white/15 pt-4 text-left sm:gap-8">
              {PERKS.map(({ icon: Icon, title }, index) => (
                <li key={title} className="flex items-center gap-2 text-[0.65rem] font-semibold text-white/62 sm:gap-2.5 sm:text-[0.72rem]">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-teal-200"><Icon className="size-3.5" /></span>
                  <span><span className="block text-white/90">0{index + 1}</span>{title}</span>
                </li>
              ))}
            </ul>
            <Link href="/#games" className="mt-7 inline-flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.18em] text-white/60 uppercase transition hover:text-white">Scroll to explore <ArrowRightIcon className="size-3.5 rotate-90" /></Link>
          </div>
        </div>
      </section>

      {/* Games */}
      <section id="games" aria-labelledby="games-title" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <SectionHeading id="games-title" eyebrow="Library">
            Find your next favourite
          </SectionHeading>
          <div id="categories" className="mt-6 scroll-mt-24">
            <CategoryChips current={filter} />
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game, index) => (
              <li key={game.id}>
                <GameCard game={game} delayMs={index * 60} />
              </li>
            ))}
            {games.length === 0 && filter !== 'all' && (
              <li className="col-span-full">
                <EmptyCategory category={filter} />
              </li>
            )}
            {filter === 'all' && (
              <>
                <li>
                  <Link href={paths.play(FEATURED.id, 'daily')} className="daily-card group">
                    <ClockIcon className="size-7 text-reward" />
                    <span className="mt-auto pt-8 text-[0.65rem] font-bold tracking-[0.16em] text-reward uppercase">A fresh challenge every day</span>
                    <h3 className="mt-2 text-xl font-extrabold tracking-tight">One day. One shot.</h3>
                    <p className="mt-2 max-w-[30ch] text-sm leading-relaxed text-muted">The same board for everyone. Make your first ranked run count.</p>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-reward">Play Daily Challenge <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" /></span>
                  </Link>
                </li>
                <li className="flex flex-col justify-center rounded-[18px] border border-dashed border-line px-6 py-8">
                  <span className="text-[0.65rem] font-bold tracking-[0.16em] text-purple uppercase">Room for more</span>
                  <h3 className="mt-3 text-xl font-extrabold tracking-tight">A small arcade.<br />Just getting started.</h3>
                  <p className="mt-3 max-w-[29ch] text-sm leading-relaxed text-muted">One game to get things rolling. More little escapes will find a home here.</p>
                  <span className="mt-6 text-xs text-muted">Puzzle · Strategy · Action · & more</span>
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
              <p className="text-[0.68rem] font-bold tracking-[0.16em] text-muted uppercase">Your account</p>
              <p className="mt-1.5 text-[1.05rem] font-extrabold tracking-[-0.01em] text-ink">
                One sign-in, every leaderboard.
              </p>
              <p className="mt-1.5 text-[0.84rem] leading-relaxed text-muted">
                Google or a code sent to your email. Your nickname, records and badges follow you to every game here.
              </p>
              <Link
                href={account.status === 'signedIn' ? paths.profile() : '#account'}
                className="mt-4 inline-flex h-10 items-center rounded-(--radius-control) bg-action px-4 text-[0.86rem] font-bold text-on-action transition hover:opacity-90"
              >
                {account.status === 'signedIn' ? 'Your profile' : 'Sign in'}
              </Link>
            </div>
            <AdSlot />
          </div>
        </div>
      </div>
    </div>
  )
}
