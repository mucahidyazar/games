import { Link } from '@/app/Link'
import { paths } from '@/app/site'
import { PlayIcon } from '@/components/icons'
import type { GameEntry } from '@/sites/games'
import { useTilt } from './useTilt'

type GameCardProps = {
  readonly game: GameEntry
  /** The hero card is bigger and carries the "Featured" label. */
  readonly isFeatured?: boolean
  /** Staggers the entrance animation, in ms. */
  readonly delayMs?: number
}

const TAG_CLASS = 'rounded-full bg-sunken px-2 py-0.5 text-[0.66rem] font-bold tracking-[0.06em] text-muted uppercase'

/**
 * A game on the portal: its cover with the name over it. The whole card is a
 * link; on hover it leans towards the pointer, brightens and shows Play.
 */
export function GameCard({ game, isFeatured = false, delayMs = 0 }: GameCardProps) {
  const tilt = useTilt()

  return (
    <Link
      href={paths.game(game.id)}
      aria-label={`Play ${game.name}`}
      className="group block animate-rise rounded-[18px] outline-none focus-visible:ring-4 focus-visible:ring-teal-400/60 motion-reduce:animate-none"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <article
        {...tilt.props}
        className="relative overflow-hidden rounded-[18px] bg-sunken ring-1 ring-line transition-[box-shadow,ring-color] duration-300 group-hover:shadow-[0_30px_60px_-24px_rgb(11_179_168/0.45)] group-hover:ring-teal-400/50"
      >
        {/* A highlight that follows the pointer; --glow fades it in over the card. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 opacity-[var(--glow,0)] transition-opacity duration-300"
          style={{
            background: 'radial-gradient(360px circle at var(--mx, 50%) var(--my, 50%), rgb(255 255 255 / 0.14), transparent 60%)',
          }}
        />
        <div className={`relative overflow-hidden ${isFeatured ? 'aspect-[16/9]' : 'aspect-[16/10]'}`}>
          <img
            src={game.cover}
            alt={game.coverAlt}
            width={1200}
            height={630}
            loading={isFeatured ? 'eager' : 'lazy'}
            fetchPriority={isFeatured ? 'high' : undefined}
            className="size-full object-cover transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-[1.04] motion-reduce:transition-none"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-surface via-surface/45 to-transparent" />
          {isFeatured && (
            <span className="absolute top-3 left-3 rounded-full bg-coral-600 px-2.5 py-1 text-[0.62rem] font-bold tracking-[0.12em] text-white uppercase shadow-coral">
              Featured
            </span>
          )}
          <span
            aria-hidden="true"
            className="absolute top-3 right-3 grid size-11 translate-y-1 place-items-center rounded-full bg-action text-on-action opacity-0 shadow-lift transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <PlayIcon className="size-4" />
          </span>
        </div>
        <div className={`relative ${isFeatured ? 'px-5 pt-4 pb-5' : 'px-4 pt-3.5 pb-4'}`}>
          <div className="flex flex-wrap items-center gap-1.5">
            {game.tags.map((tag) => (
              <span key={tag} className={TAG_CLASS}>
                {tag}
              </span>
            ))}
          </div>
          <h3 className={`mt-2 font-extrabold tracking-[-0.02em] text-ink ${isFeatured ? 'text-[1.5rem]' : 'text-[1.1rem]'}`}>
            {game.name}
          </h3>
          <p className={`mt-1 text-muted ${isFeatured ? 'text-[0.95rem]' : 'text-[0.84rem]'}`}>{game.tagline}</p>
          {isFeatured && (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] font-semibold text-accent">
              {game.highlights.map((highlight) => (
                <li key={highlight} className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-teal-400" />
                  {highlight}
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    </Link>
  )
}

/** A dashed placeholder where the next game will appear. */
export function ComingSoonCard({ title, delayMs = 0 }: { readonly title: string; readonly delayMs?: number }) {
  return (
    <div
      className="flex aspect-[16/10] animate-rise flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-line bg-sunken text-center motion-reduce:animate-none sm:aspect-auto sm:min-h-[220px]"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-full bg-sunken text-[1.3rem] font-extrabold text-muted"
      >
        ?
      </span>
      <div>
        <p className="text-[0.66rem] font-bold tracking-[0.14em] text-muted uppercase">Coming soon</p>
        <p className="mt-1 text-[0.9rem] font-semibold text-muted">{title}</p>
      </div>
    </div>
  )
}
