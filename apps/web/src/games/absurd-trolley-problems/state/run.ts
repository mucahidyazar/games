import type { TrolleyTally } from '@games/contract'
import { CHAPTERS, DEFAULT_SURVIVORS, MAX_SURVIVORS } from '../content/dilemmas'
import type { ArchetypeId } from '../content/strings'
import { livesOf, type Actor, type AnyChapter, type AnyDilemma, type Dilemma, type TrolleyChoice, type TrolleyVoteId } from '../content/types'

/** What a player chose, on the absurd dilemmas and on Foot's cases alike (their ids never clash). */
export type Answers = Partial<Record<TrolleyVoteId, TrolleyChoice>>
export type Tallies = Partial<Record<TrolleyVoteId, TrolleyTally>>

/** Which tracks the tram goes through for a choice. */
export function hitTracks(dilemma: AnyDilemma, choice: TrolleyChoice): readonly ('A' | 'B')[] {
  if (choice === 'stay') return ['A']
  return dilemma.special === 'drift' ? ['A', 'B'] : ['B']
}

export function isProp(actor: Actor): boolean {
  return !(actor.kind === 'person' || actor.kind === 'cat' || actor.kind === 'dog' || actor.kind === 'duck' || actor.kind === 'horse')
}

/** The people and animals the tram spares for a choice (nobody is spared by a drift). */
export function sparedActors(dilemma: AnyDilemma, choice: TrolleyChoice, trackA: readonly Actor[] = dilemma.trackA): readonly Actor[] {
  const hit = hitTracks(dilemma, choice)
  const spared = [...(hit.includes('A') ? [] : trackA), ...(hit.includes('B') ? [] : dilemma.trackB)]
  return spared.filter((actor) => !isProp(actor))
}

/**
 * The finale's crowd: everyone the player spared earlier in the run, picked
 * round-robin across dilemmas so each decision is represented.
 */
export function survivorsFor(answers: Answers, dilemmas: readonly Dilemma[] = CHAPTERS.flatMap((chapter) => chapter.dilemmas)): readonly Actor[] {
  const groups = dilemmas
    .filter((dilemma) => dilemma.special !== 'survivors')
    .map((dilemma) => {
      const choice = answers[dilemma.id]
      return choice ? [...sparedActors(dilemma, choice)] : []
    })
    .filter((group) => group.length > 0)
  const crowd: Actor[] = []
  for (let round = 0; crowd.length < MAX_SURVIVORS && groups.some((group) => group.length > round); round++) {
    for (const group of groups) {
      const actor = group[round]
      if (actor && crowd.length < MAX_SURVIVORS) crowd.push(actor)
    }
  }
  return crowd.length > 0 ? crowd : DEFAULT_SURVIVORS
}

/** Track A as the scene should show it: the finale swaps in the player's survivors. */
export function trackAFor(dilemma: AnyDilemma, answers: Answers): readonly Actor[] {
  return dilemma.special === 'survivors' ? survivorsFor(answers) : dilemma.trackA
}

export interface Losses {
  readonly lives: number
  readonly things: number
}

export function lossesFor(dilemma: AnyDilemma, choice: TrolleyChoice, trackA: readonly Actor[] = dilemma.trackA): Losses {
  const hit = hitTracks(dilemma, choice)
  const victims = [...(hit.includes('A') ? trackA : []), ...(hit.includes('B') ? dilemma.trackB : [])]
  const lives = livesOf(victims)
  return { lives, things: victims.length - lives }
}

/** Every life the player's choices have cost so far, across both chapters (or another set's `dilemmas`). */
export function killCount(answers: Answers, dilemmas: readonly AnyDilemma[] = CHAPTERS.flatMap((chapter) => chapter.dilemmas)): number {
  let lives = 0
  for (const dilemma of dilemmas) {
    const choice = answers[dilemma.id as TrolleyVoteId]
    if (choice) lives += lossesFor(dilemma, choice, trackAFor(dilemma, answers)).lives
  }
  return lives
}

/** Share of the community that pulled, or null when nobody has voted. */
export function pullShare(tally: TrolleyTally | undefined): number | null {
  if (!tally) return null
  const total = tally.pull + tally.stay
  return total === 0 ? null : tally.pull / total
}

export function totalVotes(tally: TrolleyTally | undefined): number {
  return tally ? tally.pull + tally.stay : 0
}

/** The tally including the player's own vote while the server's copy is on its way. */
export function withOwnVote(tally: TrolleyTally | undefined, choice: TrolleyChoice): TrolleyTally {
  const base = tally ?? { pull: 0, stay: 0 }
  return { ...base, [choice]: base[choice] + 1 }
}

export interface ChapterSummary {
  readonly answered: number
  readonly lives: number
  readonly things: number
  readonly pulls: number
  /** Share of decisions that matched the majority, among dilemmas with votes; null without data. */
  readonly agreement: number | null
  readonly archetype: ArchetypeId
}

export function summarize(chapter: AnyChapter, answers: Answers, tallies: Tallies): ChapterSummary {
  let lives = 0
  let things = 0
  let pulls = 0
  let answered = 0
  let smaller = 0
  let larger = 0
  let compared = 0
  let agreed = 0
  let drifted = false

  for (const dilemma of chapter.dilemmas) {
    const id = dilemma.id as TrolleyVoteId
    const choice = answers[id]
    if (!choice) continue
    answered += 1
    const trackA = trackAFor(dilemma, answers)
    const loss = lossesFor(dilemma, choice, trackA)
    lives += loss.lives
    things += loss.things
    if (choice === 'pull') pulls += 1
    if (dilemma.special === 'drift' && choice === 'pull') drifted = true

    const other = lossesFor(dilemma, choice === 'pull' ? 'stay' : 'pull', trackA)
    if (other.lives !== loss.lives) {
      if (loss.lives < other.lives) smaller += 1
      else larger += 1
    }

    const share = pullShare(tallies[id])
    if (share !== null && share !== 0.5) {
      compared += 1
      if ((share > 0.5 ? 'pull' : 'stay') === choice) agreed += 1
    }
  }

  const agreement = compared >= 3 ? agreed / compared : null
  const decided = smaller + larger
  // How you act (always pull, never pull) says more than what it cost, so it is checked first.
  let archetype: ArchetypeId = 'grey'
  if (answered >= 6 && pulls / answered >= 0.8) archetype = 'lever'
  else if (answered >= 6 && pulls / answered <= 0.2) archetype = 'bystander'
  else if (decided > 0 && (larger / decided >= 0.6 || (drifted && larger / decided >= 0.4))) archetype = 'chaos'
  else if (decided >= 4 && smaller / decided >= 0.8) archetype = 'utilitarian'
  else if (agreement !== null && agreement >= 0.8) archetype = 'herd'
  else if (agreement !== null && agreement <= 0.35) archetype = 'contrarian'

  return { answered, lives, things, pulls, agreement, archetype }
}
