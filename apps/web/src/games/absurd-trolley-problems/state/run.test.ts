import { describe, expect, it } from 'vitest'
import { cat, person, prop, strangers } from '../content/cast'
import { CHAPTERS, DEFAULT_SURVIVORS, dilemmaById, MAX_SURVIVORS } from '../content/dilemmas'
import type { Dilemma, TrolleyChoice } from '../content/types'
import {
  hitTracks,
  isProp,
  killCount,
  lossesFor,
  pullShare,
  sparedActors,
  summarize,
  survivorsFor,
  totalVotes,
  trackAFor,
  withOwnVote,
  type Answers,
  type Tallies,
} from './run'

const chapterOne = CHAPTERS[0] as (typeof CHAPTERS)[number]

const answerAll = (choice: (dilemma: Dilemma, index: number) => TrolleyChoice): Answers =>
  Object.fromEntries(chapterOne.dilemmas.map((dilemma, index) => [dilemma.id, choice(dilemma, index)]))

describe('where the tram goes', () => {
  it('runs down track A unless the lever is pulled', () => {
    const classic = dilemmaById('classic-five-vs-one')
    expect(hitTracks(classic, 'stay')).toEqual(['A'])
    expect(hitTracks(classic, 'pull')).toEqual(['B'])
  })

  it('takes both tracks when it drifts', () => {
    expect(hitTracks(dilemmaById('multi-track-drift'), 'pull')).toEqual(['A', 'B'])
    expect(hitTracks(dilemmaById('multi-track-drift'), 'stay')).toEqual(['A'])
  })

  it('tells props from the living', () => {
    expect(isProp(prop('cookie'))).toBe(true)
    expect(isProp(cat('#000'))).toBe(false)
    expect(isProp(person({ top: '#fff' }))).toBe(false)
  })
})

describe('losses', () => {
  it('counts lives and things separately', () => {
    expect(lossesFor(dilemmaById('classic-five-vs-one'), 'stay')).toEqual({ lives: 5, things: 0 })
    expect(lossesFor(dilemmaById('classic-five-vs-one'), 'pull')).toEqual({ lives: 1, things: 0 })
    expect(lossesFor(dilemmaById('cookies-vs-five'), 'pull')).toEqual({ lives: 0, things: 1 })
    expect(lossesFor(dilemmaById('multi-track-drift'), 'pull')).toEqual({ lives: 2, things: 0 })
    expect(lossesFor(dilemmaById('couch-vs-nobody'), 'pull')).toEqual({ lives: 0, things: 0 })
  })

  it('adds up every life the player’s choices cost', () => {
    expect(killCount({})).toBe(0)
    expect(killCount({ 'classic-five-vs-one': 'stay', 'cookies-vs-five': 'pull', 'multi-track-drift': 'pull' })).toBe(7)
  })
})

describe('survivors', () => {
  it('are whoever the tram spared', () => {
    const spared = sparedActors(dilemmaById('influencers-vs-last-cat'), 'stay')
    expect(spared).toHaveLength(1)
    expect(spared[0]?.kind).toBe('cat')
    expect(sparedActors(dilemmaById('multi-track-drift'), 'pull')).toEqual([])
    expect(sparedActors(dilemmaById('cookies-vs-five'), 'pull')).toHaveLength(5)
  })

  it('gather for the finale, one from each decision first', () => {
    const crowd = survivorsFor({ 'influencers-vs-last-cat': 'stay', 'classic-five-vs-one': 'pull', 'cats-vs-dog': 'stay' })
    expect(crowd[0]?.kind).toBe('cat')
    expect(crowd[1]?.kind).toBe('person')
    expect(crowd[2]?.kind).toBe('dog')
    expect(crowd.length).toBeLessThanOrEqual(MAX_SURVIVORS)
  })

  it('never exceed the track and fall back to a default crowd', () => {
    const everyone = answerAll(() => 'pull')
    expect(survivorsFor(everyone)).toHaveLength(MAX_SURVIVORS)
    expect(survivorsFor({})).toBe(DEFAULT_SURVIVORS)
  })

  it('replace track A only in the finale', () => {
    const finale = dilemmaById('everyone-you-saved')
    const answers: Answers = { 'influencers-vs-last-cat': 'stay' }
    expect(trackAFor(finale, answers)[0]?.kind).toBe('cat')
    expect(trackAFor(dilemmaById('footbridge'), answers)).toBe(dilemmaById('footbridge').trackA)
  })
})

describe('community tallies', () => {
  it('turn votes into a share', () => {
    expect(pullShare(undefined)).toBeNull()
    expect(pullShare({ pull: 0, stay: 0 })).toBeNull()
    expect(pullShare({ pull: 3, stay: 1 })).toBe(0.75)
    expect(totalVotes({ pull: 3, stay: 1 })).toBe(4)
    expect(totalVotes(undefined)).toBe(0)
  })

  it('include the player’s own vote while it is on its way', () => {
    expect(withOwnVote(undefined, 'pull')).toEqual({ pull: 1, stay: 0 })
    expect(withOwnVote({ pull: 2, stay: 5 }, 'stay')).toEqual({ pull: 2, stay: 6 })
  })
})

describe('the chapter summary', () => {
  const majority = (choice: TrolleyChoice): Tallies =>
    Object.fromEntries(chapterOne.dilemmas.map((dilemma) => [dilemma.id, choice === 'pull' ? { pull: 9, stay: 1 } : { pull: 1, stay: 9 }]))

  it('adds up the damage', () => {
    const summary = summarize(chapterOne, answerAll(() => 'stay'), {})
    expect(summary.answered).toBe(12)
    expect(summary.pulls).toBe(0)
    expect(summary.lives).toBeGreaterThan(0)
    expect(summary.agreement).toBeNull()
  })

  it('calls out the lever addict and the bystander', () => {
    expect(summarize(chapterOne, answerAll((_d, i) => (i < 10 ? 'pull' : 'stay')), {}).archetype).toBe('lever')
    expect(summarize(chapterOne, answerAll(() => 'stay'), {}).archetype).toBe('bystander')
  })

  it('spots chaos: the larger loss, again and again', () => {
    const chaos = answerAll((dilemma, index) => {
      const pullLives = lossesFor(dilemma, 'pull').lives
      const stayLives = lossesFor(dilemma, 'stay').lives
      if (pullLives === stayLives) return index % 2 === 0 ? 'pull' : 'stay'
      return pullLives > stayLives ? 'pull' : 'stay'
    })
    expect(summarize(chapterOne, chaos, {}).archetype).toBe('chaos')
  })

  it('spots the utilitarian: the smaller loss almost every time', () => {
    const careful = answerAll((dilemma, index) => {
      const pullLives = lossesFor(dilemma, 'pull').lives
      const stayLives = lossesFor(dilemma, 'stay').lives
      if (pullLives === stayLives) return index % 2 === 0 ? 'pull' : 'stay'
      return pullLives < stayLives ? 'pull' : 'stay'
    })
    const summary = summarize(chapterOne, careful, {})
    expect(['utilitarian', 'lever']).toContain(summary.archetype)
  })

  it('compares with the majority once there are enough votes', () => {
    const mixed = answerAll((_d, index) => (index % 2 === 0 ? 'pull' : 'stay'))
    const agreeing = summarize(chapterOne, mixed, Object.fromEntries(chapterOne.dilemmas.map((dilemma, index) => [dilemma.id, index % 2 === 0 ? { pull: 9, stay: 1 } : { pull: 1, stay: 9 }])))
    expect(agreeing.agreement).toBe(1)
    const contrary = summarize(chapterOne, mixed, Object.fromEntries(chapterOne.dilemmas.map((dilemma, index) => [dilemma.id, index % 2 === 0 ? { pull: 1, stay: 9 } : { pull: 9, stay: 1 }])))
    expect(contrary.agreement).toBe(0)
    expect(summarize(chapterOne, answerAll(() => 'pull'), majority('pull')).agreement).toBe(1)
  })

  it('ignores ties and unanswered dilemmas', () => {
    const tie: Tallies = { 'classic-five-vs-one': { pull: 1, stay: 1 } }
    const summary = summarize(chapterOne, { 'classic-five-vs-one': 'pull' }, tie)
    expect(summary.answered).toBe(1)
    expect(summary.agreement).toBeNull()
    expect(summary.archetype).toBe('grey')
  })

  it('counts the finale’s actual crowd', () => {
    const chapterTwo = CHAPTERS[1] as (typeof CHAPTERS)[number]
    const answers: Answers = { footbridge: 'pull', 'everyone-you-saved': 'stay' }
    const summary = summarize(chapterTwo, answers, {})
    // The big man, then the five people he saved.
    expect(summary.lives).toBe(1 + strangers(5).length)
  })
})
