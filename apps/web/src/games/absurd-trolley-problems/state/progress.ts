import { isTrolleyVoteId, TROLLEY_CHOICES, type TrolleyChoice, type TrolleyVoteId } from '@games/contract'
import * as z from 'zod/mini'
import { readJson, writeJson, type KeyValueStore } from '@/games/trap-the-orb/storage/keyValueStore'
import { CHAPTERS } from '../content/dilemmas'
import { FOOT_DILEMMAS } from '../content/foot'
import type { Answers } from './run'

export const PROGRESS_KEY = 'absurdtrolley.v1.progress'

/** Where the player is and what they chose, kept on this device. */
export interface Progress {
  readonly chapter: number
  /** Dilemma within the chapter; the chapter's length means its summary is showing. */
  readonly index: number
  /** Choices on the absurd dilemmas and on Philippa Foot's cases. */
  readonly answers: Answers
  /** Which of Foot's cases is on; their number means her end card is showing. */
  readonly foot: number
  /** Random, anonymous id that keeps one vote per dilemma per device. */
  readonly voterId: string
  readonly music: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const intSchema = z.int()
const answersSchema = z.record(z.string(), z.unknown())
const voterSchema = z.string().check(z.regex(UUID))
const musicSchema = z.boolean()

/** A random UUID: a player's id, and their anonymous voting id. */
export function randomId(random: () => number = Math.random): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // RFC 4122 version 4 layout from a weaker source, for very old browsers.
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16))
  hex[12] = '4'
  hex[16] = ((parseInt(hex[16] ?? '8', 16) & 0x3) | 0x8).toString(16)
  const s = hex.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

export function newProgress(random?: () => number): Progress {
  return { chapter: 0, index: 0, answers: {}, foot: 0, voterId: randomId(random), music: true }
}

const isChoice = (value: unknown): value is TrolleyChoice => (TROLLEY_CHOICES as readonly unknown[]).includes(value)

/** Stored progress, repaired field by field so one bad value never resets everything. */
export function loadProgress(store: KeyValueStore | null): Progress {
  return parseProgress(readJson(store, PROGRESS_KEY))
}

/** Progress from stored JSON, repaired field by field. */
export function parseProgress(raw: unknown): Progress {
  const fresh = newProgress()
  if (typeof raw !== 'object' || raw === null) return fresh
  const record = raw as Record<string, unknown>

  const chapterValue = intSchema.safeParse(record.chapter)
  const chapter = chapterValue.success && chapterValue.data >= 0 && chapterValue.data < CHAPTERS.length ? chapterValue.data : 0
  const length = CHAPTERS[chapter]?.dilemmas.length ?? 0
  const indexValue = intSchema.safeParse(record.index)
  // A bad chapter makes the stored index meaningless too.
  const index = chapterValue.success && chapter === chapterValue.data && indexValue.success && indexValue.data >= 0 && indexValue.data <= length ? indexValue.data : 0
  const answers: Record<string, TrolleyChoice> = {}
  const storedAnswers = answersSchema.safeParse(record.answers)
  for (const [id, choice] of Object.entries(storedAnswers.success ? storedAnswers.data : {})) {
    if (isTrolleyVoteId(id) && isChoice(choice)) answers[id] = choice
  }
  const footValue = intSchema.safeParse(record.foot)
  const foot = footValue.success && footValue.data >= 0 && footValue.data <= FOOT_DILEMMAS.length ? footValue.data : 0
  const voterId = voterSchema.safeParse(record.voterId)
  const music = musicSchema.safeParse(record.music)
  return {
    chapter,
    index,
    answers,
    foot,
    voterId: voterId.success ? voterId.data : fresh.voterId,
    music: music.success ? music.data : true,
  }
}

/**
 * Forgets one dilemma's answer so it can be played again. A chapter whose
 * summary (or Foot's end card) was showing steps back to its first
 * unanswered dilemma.
 */
export function withoutAnswer(progress: Progress, id: TrolleyVoteId): Progress {
  if (!(id in progress.answers)) return progress
  const answers: Answers = { ...progress.answers }
  delete answers[id]
  if (FOOT_DILEMMAS.some((dilemma) => dilemma.id === id)) {
    const gap = progress.foot >= FOOT_DILEMMAS.length ? FOOT_DILEMMAS.findIndex((dilemma) => !(dilemma.id in answers)) : -1
    return { ...progress, answers, foot: gap >= 0 ? gap : progress.foot }
  }
  const chapter = CHAPTERS[progress.chapter]
  const gap = chapter && progress.index >= chapter.dilemmas.length ? chapter.dilemmas.findIndex((dilemma) => !(dilemma.id in answers)) : -1
  return { ...progress, answers, index: gap >= 0 ? gap : progress.index }
}

/** Forgets every answer to Foot's cases, and starts them from the first. */
export function withoutFoot(progress: Progress): Progress {
  const answers: Answers = { ...progress.answers }
  for (const dilemma of FOOT_DILEMMAS) delete answers[dilemma.id]
  return { ...progress, answers, foot: 0 }
}

/** Forgets every answer in a chapter; a player inside it goes back to its first dilemma. */
export function withoutChapter(progress: Progress, chapterIndex: number): Progress {
  const chapter = CHAPTERS[chapterIndex]
  if (!chapter) return progress
  const answers: Answers = { ...progress.answers }
  for (const dilemma of chapter.dilemmas) delete answers[dilemma.id]
  return { ...progress, answers, index: progress.chapter === chapterIndex ? 0 : progress.index }
}

export function saveProgress(store: KeyValueStore | null, progress: Progress): boolean {
  return writeJson(store, PROGRESS_KEY, progress)
}
