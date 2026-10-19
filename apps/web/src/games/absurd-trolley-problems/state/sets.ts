import { CHAPTERS } from '../content/dilemmas'
import { FOOT_CHAPTER, FOOT_DILEMMAS } from '../content/foot'
import type { AnyChapter, AnyDilemma } from '../content/types'
import type { Progress } from './progress'

/**
 * The two sets of problems the game plays: the absurd dilemmas, in two
 * chapters, and Philippa Foot's cases, as one. Both play, list and compare
 * the same way; only where a player is in each is kept apart.
 */

export type SetId = 'absurd' | 'foot'

export const SET_CHAPTERS: Readonly<Record<SetId, readonly AnyChapter[]>> = { absurd: CHAPTERS, foot: [FOOT_CHAPTER] }

export function setDilemmas(set: SetId): readonly AnyDilemma[] {
  return SET_CHAPTERS[set].flatMap((chapter) => chapter.dilemmas)
}

/** Which set a dilemma belongs to. */
export function setOf(id: string): SetId {
  return FOOT_DILEMMAS.some((dilemma) => dilemma.id === id) ? 'foot' : 'absurd'
}

/** Where a player is in a set: the chapter, and the dilemma within it (its length means the chapter's end). */
export interface Position {
  readonly chapter: number
  readonly index: number
}

export function positionIn(progress: Progress, set: SetId): Position {
  return set === 'foot' ? { chapter: 0, index: progress.foot } : { chapter: progress.chapter, index: progress.index }
}

export function moveTo(progress: Progress, set: SetId, position: Position): Progress {
  return set === 'foot' ? { ...progress, foot: position.index } : { ...progress, chapter: position.chapter, index: position.index }
}

/** Where to find a dilemma: its set, chapter and place in the chapter. */
export function locate(id: string): { readonly set: SetId; readonly position: Position } | null {
  for (const set of ['absurd', 'foot'] as const) {
    const chapters = SET_CHAPTERS[set]
    for (const [chapter, entry] of chapters.entries()) {
      const index = entry.dilemmas.findIndex((dilemma) => dilemma.id === id)
      if (index >= 0) return { set, position: { chapter, index } }
    }
  }
  return null
}
