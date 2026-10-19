import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '@/games/trap-the-orb/storage/memoryStore'
import { FOOT_DILEMMAS } from '../content/foot'
import { loadProgress, newProgress, PROGRESS_KEY, saveProgress, withoutAnswer, withoutChapter, withoutFoot } from './progress'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('progress', () => {
  it('starts at the first dilemma with music on and a random voter id', () => {
    const progress = newProgress()
    expect(progress).toMatchObject({ chapter: 0, index: 0, answers: {}, foot: 0, music: true })
    expect(progress.voterId).toMatch(UUID)
    expect(newProgress().voterId).not.toBe(progress.voterId)
  })

  it('builds a valid id without crypto.randomUUID', () => {
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      let n = 0
      expect(newProgress(() => (n++ % 16) / 16).voterId).toMatch(UUID)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })

  it('round-trips through storage', () => {
    const store = createMemoryStore()
    const progress = { ...newProgress(), chapter: 1, index: 3, answers: { footbridge: 'pull' as const }, music: false }
    expect(saveProgress(store, progress)).toBe(true)
    expect(loadProgress(store)).toEqual(progress)
  })

  it('repairs what it can and drops the rest', () => {
    const store = createMemoryStore()
    store.setItem(
      PROGRESS_KEY,
      JSON.stringify({ chapter: 7, index: 40, answers: { footbridge: 'pull', nope: 'pull', 'cats-vs-dog': 'maybe' }, voterId: 'me', music: 'loud' }),
    )
    const progress = loadProgress(store)
    expect(progress.chapter).toBe(0)
    expect(progress.index).toBe(0)
    expect(progress.answers).toEqual({ footbridge: 'pull' })
    expect(progress.voterId).toMatch(UUID)
  })

  it('keeps Philippa Foot’s cases beside the absurd ones', () => {
    const store = createMemoryStore()
    store.setItem(PROGRESS_KEY, JSON.stringify({ chapter: 0, index: 2, answers: { 'foot-judge': 'stay', 'foot-nope': 'pull' }, foot: 4 }))
    expect(loadProgress(store)).toMatchObject({ answers: { 'foot-judge': 'stay' }, foot: 4 })
    store.setItem(PROGRESS_KEY, JSON.stringify({ foot: 99 }))
    expect(loadProgress(store).foot).toBe(0)
  })

  it('takes back one of Foot’s answers, stepping her end card back to the gap', () => {
    const finished = { ...newProgress(), foot: FOOT_DILEMMAS.length, answers: { 'foot-driver': 'pull', 'foot-judge': 'stay', footbridge: 'pull' } as const }
    const after = withoutAnswer(finished, 'foot-judge')
    expect(after).toMatchObject({ foot: 1, answers: { 'foot-driver': 'pull', footbridge: 'pull' } })
    expect(withoutAnswer({ ...finished, foot: 3 }, 'foot-judge').foot).toBe(3)
    // All of Foot's at once, the absurd ones untouched.
    expect(withoutFoot(finished)).toMatchObject({ foot: 0, answers: { footbridge: 'pull' } })
  })

  it('keeps a finished chapter on its summary', () => {
    const store = createMemoryStore()
    store.setItem(PROGRESS_KEY, JSON.stringify({ chapter: 1, index: 12, answers: {} }))
    expect(loadProgress(store)).toMatchObject({ chapter: 1, index: 12, music: true })
  })

  it('takes back one answer, and steps a finished chapter back to its first gap', () => {
    const finished = { ...newProgress(), chapter: 0, index: 12, answers: { 'influencers-vs-last-cat': 'pull', 'classic-five-vs-one': 'stay', footbridge: 'pull' } as const }
    const after = withoutAnswer(finished, 'classic-five-vs-one')
    expect(after.answers).toEqual({ 'influencers-vs-last-cat': 'pull', footbridge: 'pull' })
    expect(after.index).toBe(1)
    // Elsewhere in the game, the player stays where they are.
    const elsewhere = { ...finished, chapter: 1, index: 3 }
    expect(withoutAnswer(elsewhere, 'classic-five-vs-one').index).toBe(3)
    expect(withoutAnswer(elsewhere, 'monday-vs-friday')).toBe(elsewhere)
  })

  it('takes back a whole chapter, sending a player inside it back to its start', () => {
    const progress = { ...newProgress(), chapter: 0, index: 7, answers: { 'influencers-vs-last-cat': 'pull', 'cats-vs-dog': 'stay', footbridge: 'pull' } as const }
    const after = withoutChapter(progress, 0)
    expect(after.answers).toEqual({ footbridge: 'pull' })
    expect(after.index).toBe(0)
    expect(withoutChapter(progress, 1)).toMatchObject({ index: 7, answers: { 'influencers-vs-last-cat': 'pull', 'cats-vs-dog': 'stay' } })
    expect(withoutChapter(progress, 9)).toBe(progress)
  })

  it('starts fresh without storage or with garbage', () => {
    expect(loadProgress(null).index).toBe(0)
    const store = createMemoryStore()
    store.setItem(PROGRESS_KEY, 'not json')
    expect(loadProgress(store).answers).toEqual({})
    expect(saveProgress(null, newProgress())).toBe(false)
  })
})
