# Product

## Register

product

## Users

Casual players who want a quick, skill-based arcade break: a few minutes on a phone (a commute, a queue, the sofa) or in a browser tab. Most play as guests; some sign in on the web to chase leaderboards, records and badges. On phones they hold the device upright, often in one hand, and play in short bursts that get interrupted.

## Product Purpose

Trap The Orb is a free arcade game. Orbs bounce around a field and the player builds walls to trap them in ever smaller spaces; claiming 75% of the field clears a level. It ships as a browser game (games.mucahid.dev, traptheorb.com) and as iOS and Android apps built with Unity on the same deterministic engine. Success means a player understands the game within the first level, gets into flow quickly and comes back for one more run.

## Brand Personality

Clean, crisp, playful. A minimal arcade in the spirit of Two Dots, Threes! and Mini Metro: the field is the hero, the interface steps back, and colour and motion carry the fun. Confident and calm rather than loud. Delight comes from the orbs, the captures and small celebrations, not from decoration.

## Anti-references

- A website or dashboard squeezed onto a phone: nested cards, small text links, rows of boxed statistics, controls at the top of the screen. This is what the first Unity port looked like, and what the mobile redesign replaces.

## Design Principles

1. **The field is the hero.** Every screen gives the board the most room it can; chrome stays compact and quiet while a level is being played.
2. **Thumb first.** Frequent actions sit in the lower half of the screen, every target is at least 44pt, and nothing important is a small text link.
3. **One obvious next step.** Each state (home, playing, paused, level cleared, run over) has a single clear primary action.
4. **Same game, native on each device.** One engine and one scoring model everywhere; layouts are composed for the device instead of shrinking the web.
5. **Motion explains what happened.** Captures, broken walls, cleared levels and new records get feedback; nothing moves just to decorate.

## Accessibility & Inclusion

- WCAG 2.2 AA: body text at least 4.5:1 and large text at least 3:1 against its background, in both themes.
- Touch targets of at least 44×44pt.
- A reduced-motion setting (following the system setting where the platform exposes it) that removes shake, particles and non-essential transitions.
- Orb speed tiers are told apart by more than colour, and the speed is also named in words.
- Sound and haptics can be switched off independently.
