import type { ReactElement } from 'react'
import { OrbLineup } from '@/games/trap-the-orb/components/OrbLineup'

/** "How to play" copy. Rendered inside a `.prose-dialog` container. */
export function HowToPlayContent(): ReactElement {
  return (
    <>
      <h3>Goal</h3>
      <p>
        Orbs bounce around the field. Build walls to trap them in smaller and smaller spaces, and{' '}
        <strong>claim at least 75% of the field</strong> to clear the level.
      </p>

      <h3>Orbs and levels</h3>
      <p>An orb’s colour tells you how fast it is:</p>
      <ul>
        <li>
          <OrbLineup tiers={[0]} size="sm" /> <strong>Calm</strong> — the starting speed
        </li>
        <li>
          <OrbLineup tiers={[1]} size="sm" /> <strong>Quick</strong> — 1.2×
        </li>
        <li>
          <OrbLineup tiers={[2]} size="sm" /> <strong>Fast</strong> — 1.4×
        </li>
        <li>
          <OrbLineup tiers={[3]} size="sm" /> <strong>Blazing</strong> — 1.6×
        </li>
      </ul>
      <p>
        Level 1 has a single calm orb. Level 2 adds a second one, level 3 speeds one of them up and level 4 speeds up
        the other. Then a third orb joins and everyone calms down for a moment — a breather — before they speed up
        again. Each round starts a little harder than the one before, and the Speed gauge always shows your fastest
        orb.
      </p>
      <p>You get one life more than there are orbs, and your lives refill at the start of every level.</p>

      <h3>Modes</h3>
      <p>
        <strong>Ranked modes</strong> have the same rules for everyone, so their leaderboards stay fair:
      </p>
      <dl>
        <dt>Classic</dt>
        <dd>The standard game described above.</dd>
        <dt>Daily Challenge</dt>
        <dd>Classic rules on the same layout for everyone. Only your first attempt each day is ranked.</dd>
        <dt>Time Attack</dt>
        <dd>Each level has a countdown (30 seconds plus 15 per orb). Seconds left over become bonus points.</dd>
        <dt>Limited Walls</dt>
        <dd>A small wall budget per level (4 plus 2 per orb). Unused walls become bonus points.</dd>
        <dt>Hardcore</dt>
        <dd>One life for the whole run.</dd>
      </dl>
      <p>
        <strong>Practice modes</strong> are never ranked. <strong>Zen</strong> gives you unlimited lives, and{' '}
        <strong>Custom</strong> lets you choose the orbs, their speed, lives, walls, timer and target area — start from
        the Easy, Normal, Hard or Expert preset and adjust from there. Practice runs are saved at every level, so you
        can close the tab and <strong>Continue</strong> later.
      </p>

      <h3>Controls</h3>
      <dl>
        <dt>Mouse</dt>
        <dd>Click a free spot to build a wall. Right-click to switch between vertical and horizontal walls.</dd>
        <dt>Touch</dt>
        <dd>Tap a free spot to build in the current direction, or swipe to build in the direction of your swipe.</dd>
        <dt>Keyboard</dt>
        <dd>
          <ul>
            <li>
              <kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd> move the aim cursor
            </li>
            <li>
              <kbd>Enter</kbd> builds a wall at the cursor. It also starts the game, resumes it and goes on to the next
              level.
            </li>
            <li>
              <kbd>Space</kbd> switches between vertical and horizontal
            </li>
            <li>
              <kbd>P</kbd> or <kbd>Esc</kbd> pauses and resumes
            </li>
            <li>
              <kbd>M</kbd> turns sound on or off
            </li>
          </ul>
        </dd>
        <dt>Any device</dt>
        <dd>The ↕/↔ button next to Pause switches between vertical and horizontal.</dd>
      </dl>
      <p>On a phone held upright the field is tall; turn it sideways for a wide one. Both play exactly the same.</p>

      <h3>Rules</h3>
      <ul>
        <li>
          A wall grows in both directions at once from the spot you pick, until each half reaches a wall or the border.
        </li>
        <li>Only one wall can be under construction at a time.</li>
        <li>
          If an orb touches a wall while it’s being built, that half breaks and you lose a life. The other half can
          still finish. If both halves break at the same moment, you still lose only one life.
        </li>
        <li>
          When a wall finishes, every region with no orb inside is captured and turns mint. Walls count as captured area
          too.
        </li>
        <li>The run ends when you lose your last life, run out of time, or run out of walls.</li>
      </ul>

      <h3>Scoring</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">Points for</th>
            <th scope="col">How much</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Capturing area</th>
            <td>10 per 1% of the field × level</td>
          </tr>
          <tr>
            <th scope="row">Territory bonus</th>
            <td>50 × each whole percent above the target × level</td>
          </tr>
          <tr>
            <th scope="row">Lives bonus</th>
            <td>100 × lives left × level</td>
          </tr>
          <tr>
            <th scope="row">Speed bonus</th>
            <td>5 × each second under par (or left on the clock) × level</td>
          </tr>
          <tr>
            <th scope="row">Unused walls</th>
            <td>50 × walls left × level (Limited Walls)</td>
          </tr>
        </tbody>
      </table>
      <p>
        Bonuses are paid when you clear a level. Par time is 20 seconds plus 10 per orb: 30 seconds with one orb, 40
        with two, and so on.
      </p>

      <h3>Leaderboards and badges</h3>
      <p>
        Sign in with Google or with a code sent to your email to put your ranked runs on the leaderboards. Every run is
        replayed on our server before it counts, so the tables only show games that were really played. There are
        weekly and all-time tables for each ranked mode, a daily one for the Daily Challenge, and record tables such as
        the tightest trap and the biggest single capture.
      </p>
      <p>
        Ranked runs also earn badges in bronze, silver and gold — for boxing an orb into a tiny pocket, clearing levels
        without losing a life, beating par by a mile and more. Your profile shows every badge and what the next tier
        takes.
      </p>

      <h3>Tips</h3>
      <ul>
        <li>Build right behind an orb that’s moving away from your line. It can’t turn around in time.</li>
        <li>Short walls finish fast. A wall across a narrow corridor is much safer than one across the open field.</li>
        <li>Pen the orbs into small pockets: the less room they have, the more of the field you can claim.</li>
        <li>Save a big capture for last. Pushing well past the target in one move earns a bigger territory bonus.</li>
        <li>Keep an eye on the red and violet orbs — they close gaps much faster than the blue ones.</li>
      </ul>
    </>
  )
}
