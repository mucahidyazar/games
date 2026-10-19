import { describe, expect, it } from 'vitest'
import { FOOT_CHAPTER } from '../content/foot'
import { agreementWithFoot, compareAnswers, FOOT_AS_PLAYER, FOOT_PERSON, footProfile, principleScores, verdictFor } from './compare'

describe('compareAnswers', () => {
  it('compares only the dilemmas both have played, in chapter order', () => {
    const result = compareAnswers(
      { footbridge: 'pull', 'influencers-vs-last-cat': 'pull', 'classic-five-vs-one': 'stay', 'cats-vs-dog': 'stay' },
      { 'classic-five-vs-one': 'stay', 'influencers-vs-last-cat': 'stay', footbridge: 'pull', 'duck-vs-horses': 'pull' },
      {},
    )
    expect(result.shared.map((dilemma) => dilemma.id)).toEqual(['influencers-vs-last-cat', 'classic-five-vs-one', 'footbridge'])
    expect(result.same).toBe(2)
    expect(result.agreement).toBeCloseTo(2 / 3)
    expect(result.verdict).toBe('mostly')
  })

  it('adds up each whole game', () => {
    const result = compareAnswers({ 'influencers-vs-last-cat': 'pull', 'classic-five-vs-one': 'stay' }, { 'influencers-vs-last-cat': 'stay' }, {})
    // The cat and the classic's five; the five influencers.
    expect(result.first.kills).toBe(6)
    expect(result.second.kills).toBe(5)
    expect(result.first.summary).toMatchObject({ answered: 2, pulls: 1 })
    expect(result.second.summary).toMatchObject({ answered: 1, pulls: 0 })
  })

  it('has no verdict before they share a dilemma', () => {
    const result = compareAnswers({ footbridge: 'pull' }, { 'cats-vs-dog': 'stay' }, {})
    expect(result.shared).toEqual([])
    expect(result.agreement).toBeNull()
    expect(result.verdict).toBeNull()
  })
})

describe('Philippa Foot’s cases', () => {
  it('compare two players on her chapter alone', () => {
    const result = compareAnswers({ 'foot-driver': 'pull', 'foot-judge': 'stay', footbridge: 'pull' }, { 'foot-driver': 'stay', 'foot-judge': 'stay', footbridge: 'pull' }, {}, [FOOT_CHAPTER])
    expect(result.shared.map((dilemma) => dilemma.id)).toEqual(['foot-driver', 'foot-judge'])
    expect(result.same).toBe(1)
    // The one worker on the branch and the five hostages; the five workers and the five hostages.
    expect(result.first.kills).toBe(6)
    expect(result.second.kills).toBe(10)
  })

  it('know Foot’s own answers, leaving out the one she left open', () => {
    expect(FOOT_AS_PLAYER['foot-driver']).toBe('pull')
    expect(FOOT_AS_PLAYER['foot-cave']).toBeUndefined()
    expect(FOOT_PERSON).toMatchObject({ name: 'Philippa Foot', answers: FOOT_AS_PLAYER })
  })

  it('count how often a player sides with her, among the cases both answered', () => {
    expect(agreementWithFoot({})).toEqual({ same: 0, total: 0 })
    expect(agreementWithFoot({ 'foot-driver': 'pull', 'foot-judge': 'pull', 'foot-cave': 'pull', footbridge: 'pull' })).toEqual({ same: 1, total: 2 })
  })

  it('score a player group by group, along her line between harming and helping', () => {
    const scores = principleScores({ 'foot-driver': 'pull', 'foot-pilot': 'stay', 'foot-judge': 'pull', 'foot-cave': 'pull' })
    const of = (id: string) => scores.find((score) => score.principle.id === id)
    expect(of('harms')).toMatchObject({ answered: 2, same: 1 })
    expect(of('harm-for-aid')).toMatchObject({ answered: 1, same: 0 })
    expect(of('aid')).toMatchObject({ answered: 0, same: 0 })
    // Nobody can side with her where she gives no answer.
    expect(of('open')).toMatchObject({ answered: 1, same: 0 })
  })

  it('tell Foot’s followers from utilitarians and from those who keep their hands clean', () => {
    expect(footProfile({ 'foot-driver': 'pull' })).toBeNull()
    expect(footProfile(FOOT_AS_PLAYER)).toBe('foot')
    // Saving the most every time, harming one to help five included.
    const most = { 'foot-driver': 'pull', 'foot-pilot': 'pull', 'foot-judge': 'pull', 'foot-serum': 'pull', 'foot-gas': 'pull', 'foot-tyrant': 'pull', 'foot-drug': 'pull' } as const
    expect(footProfile(most)).toBe('utilitarian')
    // Never acting, not even to steer the tram.
    const none = { 'foot-driver': 'stay', 'foot-pilot': 'stay', 'foot-judge': 'stay', 'foot-serum': 'stay', 'foot-lifeboat': 'stay', 'foot-drug': 'pull' } as const
    expect(footProfile(none)).toBe('absolutist')
    const mixed = { 'foot-driver': 'pull', 'foot-pilot': 'stay', 'foot-judge': 'pull', 'foot-serum': 'stay', 'foot-drug': 'stay', 'foot-rescue': 'pull' } as const
    expect(footProfile(mixed)).toBe('own')
  })
})

describe('verdictFor', () => {
  it('goes from twins to opposites', () => {
    expect(verdictFor(1)).toBe('twins')
    expect(verdictFor(0.8)).toBe('twins')
    expect(verdictFor(0.6)).toBe('mostly')
    expect(verdictFor(0.3)).toBe('apart')
    expect(verdictFor(0.1)).toBe('opposites')
  })
})
