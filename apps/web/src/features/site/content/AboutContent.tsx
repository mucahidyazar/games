import type { ReactElement } from 'react'
import { Link } from '@/app/Link'
import { paths, site } from '@/app/site'
import { GAMES } from '@/sites/games'

/** The portal's "About": who makes the games and what the site is for. */
function PortalAbout(): ReactElement {
  return (
    <>
      <h2>What is games.mucahid.dev?</h2>
      <p>
        games.mucahid.dev is a small collection of free games that run right in your browser. There’s nothing to
        install and no account needed: pick a game and you’re playing in seconds. Sign in only if you want your scores
        on the leaderboards.
      </p>

      <h2>One account, every game</h2>
      <p>
        Ranked modes have the same rules for everyone, and every ranked run is replayed on our server before it counts,
        so the leaderboards only show games that were really played. Records and badges follow your account from game
        to game.
      </p>

      <h2>The games</h2>
      <ul>
        {GAMES.map((game) => (
          <li key={game.id}>
            <Link href={paths.game(game.id)}>{game.name}</Link> — {game.tagline}
          </li>
        ))}
      </ul>
      <p>More games are in the workshop. Each one is designed and built from scratch for today’s browsers.</p>

      <h2>Who makes them</h2>
      <p>
        The games are made by Mucahid, an independent developer. You can find more of his work at{' '}
        <a href="https://mucahid.dev" target="_blank" rel="noopener noreferrer">
          mucahid.dev
        </a>
        .
      </p>
    </>
  )
}

/** "About" copy. Rendered on the standalone About page. */
export function AboutContent(): ReactElement {
  if (site.kind === 'portal') return <PortalAbout />
  return <GameAbout />
}

/** The game's "About", for its own site. */
function GameAbout(): ReactElement {
  return (
    <>
      <h2>What is {site.name}?</h2>
      <p>
        {site.name} is a free arcade game that runs right in your browser. There’s nothing to install and no account
        needed, so you can start a round in seconds and stop whenever you like. Sign in only if you want your scores on
        the leaderboards.
      </p>
      <p>
        Orbs bounce around the field. You build walls to trap them in smaller and smaller spaces, and you clear a level
        by claiming at least 75% of the field. New orbs join and speed up as you climb, and the orb colours tell you
        how fast each one is.
      </p>

      <h2>Made for quick sessions</h2>
      <p>
        Levels are short, so a round fits into any break. Play with a mouse, a keyboard or a touch screen. Pick a ranked
        mode to compete — Classic, the Daily Challenge, Time Attack, Limited Walls or Hardcore — or practise in Zen and
        Custom.
      </p>

      <h2>Inspired by a classic</h2>
      <p>
        {site.name} is inspired by JezzBall, a wall-building game programmed by Dima Pavlovsky and published by
        Microsoft in 1992. Our game is a new take on that idea, designed and built from scratch for today’s browsers.
      </p>
      <p>
        {site.name} is an independent project. It is{' '}
        <strong>not affiliated with, sponsored by or endorsed by Microsoft</strong>. Microsoft is a trademark of the
        Microsoft group of companies.
      </p>

      <h2>Coming soon</h2>
      <p>{site.name} apps for iOS and Android are on the way.</p>

      <h2>More games</h2>
      <p>
        {site.name} is one of the games at{' '}
        <a href={paths.allGames()} target="_blank" rel="noopener noreferrer">
          games.mucahid.dev
        </a>
        , all made by Mucahid.
      </p>
    </>
  )
}
