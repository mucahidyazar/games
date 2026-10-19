import { CHAPTERS } from '../content/dilemmas'
import { FOOT_ANSWERS, FOOT_DILEMMAS, FOOT_PRINCIPLES, type FootDilemmaId, type FootPrinciple, type FootPrincipleId } from '../content/foot'
import type { FootProfileId } from '../content/strings'
import type { AnyChapter, AnyDilemma, TrolleyChoice } from '../content/types'
import { killCount, summarize, type Answers, type ChapterSummary, type Tallies } from './run'

/**
 * Two players side by side: how often they made the same call on the
 * dilemmas they have both played, and how their whole games add up.
 */

export type Verdict = 'twins' | 'mostly' | 'apart' | 'opposites'

export interface Comparison {
  /** Dilemmas both have played, in chapter order. */
  readonly shared: readonly AnyDilemma[]
  /** How many of those they answered the same way. */
  readonly same: number
  /** `same / shared.length`; null until they share a dilemma. */
  readonly agreement: number | null
  readonly verdict: Verdict | null
  readonly first: PlayerTotals
  readonly second: PlayerTotals
}

export interface PlayerTotals {
  readonly summary: ChapterSummary
  readonly kills: number
}

/** A set's chapters as one, for a whole-game summary. */
const wholeGame = (chapters: readonly AnyChapter[]): AnyChapter => ({ id: 'all', title: chapters[0]?.title ?? { tr: '', en: '' }, dilemmas: chapters.flatMap((chapter) => chapter.dilemmas) })

export function verdictFor(agreement: number): Verdict {
  if (agreement >= 0.8) return 'twins'
  if (agreement >= 0.5) return 'mostly'
  if (agreement >= 0.2) return 'apart'
  return 'opposites'
}

/** Two players' games in one set (the absurd chapters by default). */
export function compareAnswers(first: Answers, second: Answers, tallies: Tallies, chapters: readonly AnyChapter[] = CHAPTERS): Comparison {
  const whole = wholeGame(chapters)
  const answer = (answers: Answers, dilemma: AnyDilemma) => answers[dilemma.id as keyof Answers]
  const shared = whole.dilemmas.filter((dilemma) => answer(first, dilemma) && answer(second, dilemma))
  const same = shared.filter((dilemma) => answer(first, dilemma) === answer(second, dilemma)).length
  const agreement = shared.length > 0 ? same / shared.length : null
  return {
    shared,
    same,
    agreement,
    verdict: agreement === null ? null : verdictFor(agreement),
    first: { summary: summarize(whole, first, tallies), kills: killCount(first, whole.dilemmas) },
    second: { summary: summarize(whole, second, tallies), kills: killCount(second, whole.dilemmas) },
  }
}

/** Someone whose choices can be compared: a player on this device, or Philippa Foot herself. */
export interface Comparable {
  readonly id: string
  readonly name: string
  readonly color: string
  readonly answers: Answers
}

/** Philippa Foot's own answers, as a player's would be (she leaves the cave open). */
export const FOOT_AS_PLAYER: Answers = Object.fromEntries(Object.entries(FOOT_ANSWERS).filter(([, choice]) => choice !== null))

/** Foot herself, to be compared with on her own cases. */
export const FOOT_PERSON: Comparable = { id: 'philippa-foot', name: 'Philippa Foot', color: '#e9dcc0', answers: FOOT_AS_PLAYER }

/** How many of the cases Foot answered the player answered her way, out of those both answered. */
export function agreementWithFoot(answers: Answers): { readonly same: number; readonly total: number } {
  let same = 0
  let total = 0
  for (const dilemma of FOOT_DILEMMAS) {
    const foot = FOOT_AS_PLAYER[dilemma.id]
    const yours = answers[dilemma.id]
    if (!foot || !yours) continue
    total += 1
    if (yours === foot) same += 1
  }
  return { same, total }
}

export interface PrincipleScore {
  readonly principle: FootPrinciple
  /** The group's cases the player has answered. */
  readonly answered: number
  /** How many of those went Foot's way (none can, where she leaves the case open). */
  readonly same: number
}

/** The player's calls, group by group, along the line Foot draws between harming and helping. */
export function principleScores(answers: Answers): readonly PrincipleScore[] {
  return FOOT_PRINCIPLES.map((principle) => {
    const answered = principle.cases.filter((id) => answers[id])
    const same = answered.filter((id) => FOOT_ANSWERS[id] !== null && answers[id] === FOOT_ANSWERS[id]).length
    return { principle, answered: answered.length, same }
  })
}

const groupCases = (id: FootPrincipleId): readonly FootDilemmaId[] => FOOT_PRINCIPLES.find((principle) => principle.id === id)?.cases ?? []

/** Of the answered cases among `ids`, the share that went `choice`'s way (and how many were answered). */
function shareOf(answers: Answers, ids: readonly FootDilemmaId[], choice: TrolleyChoice): { readonly answered: number; readonly share: number } {
  const answered = ids.filter((id) => answers[id])
  return { answered: answered.length, share: answered.length > 0 ? answered.filter((id) => answers[id] === choice).length / answered.length : 0 }
}

/**
 * Where a player stands against the essay: with Foot, past her towards
 * saving the most whatever it takes, short of her towards never acting at
 * all, or somewhere of their own. Null until there is enough to go on.
 */
export function footProfile(answers: Answers): FootProfileId | null {
  const { same, total } = agreementWithFoot(answers)
  if (total < 4) return null
  if (same / total >= 0.8) return 'foot'
  // Harming one to help more: Foot refuses, a utilitarian goes ahead.
  const harmForAid = shareOf(answers, groupCases('harm-for-aid'), 'pull')
  if (harmForAid.answered >= 2 && harmForAid.share >= 0.6) return 'utilitarian'
  // Where even Foot acts to save more, someone with clean hands still holds back.
  const holdsBack = shareOf(answers, [...groupCases('harms'), ...groupCases('no-one-spared')], 'stay')
  if (holdsBack.answered >= 2 && holdsBack.share > 0.5) return 'absolutist'
  return 'own'
}
