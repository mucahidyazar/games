import { TROLLEY_DILEMMA_IDS } from '@games/contract'
import { describe, expect, it } from 'vitest'
import { RIG } from '../scene/layout'
import { INFLUENCERS, strangers } from './cast'
import { CHAPTERS, DILEMMAS, dilemmaById } from './dilemmas'
import { ARCHETYPES, count, percent, turkishPercentSuffix, UI } from './strings'
import { livesOf, type Actor, type Localized } from './types'

const filled = (copy: Localized): boolean => copy.tr.trim().length > 0 && copy.en.trim().length > 0

describe('the dilemmas', () => {
  it('are exactly the ones the API accepts, in chapter order', () => {
    expect(DILEMMAS.map((dilemma) => dilemma.id)).toEqual([...TROLLEY_DILEMMA_IDS])
    expect(CHAPTERS.map((chapter) => chapter.dilemmas.length)).toEqual([12, 12])
    expect(dilemmaById('footbridge').special).toBe('footbridge')
    expect(() => dilemmaById('nope' as never)).toThrow(/Unknown dilemma/)
  })

  it('open with the key frame’s influencers and cat', () => {
    const first = DILEMMAS[0]
    expect(first?.title.tr).toBe('5 influencer mı, son kedi mi?')
    expect(first?.setup.tr).toBe('Kontrolden çıkan tramvay yaklaşıyor. Karar senin.')
    expect(first?.trackA).toHaveLength(5)
    expect(first?.trackB[0]?.kind).toBe('cat')
  })

  it.each(DILEMMAS.map((dilemma) => [dilemma.id, dilemma] as const))('%s is written in both languages', (_id, dilemma) => {
    expect(filled(dilemma.title)).toBe(true)
    expect(filled(dilemma.setup)).toBe(true)
    expect(filled(dilemma.outcome.pull)).toBe(true)
    expect(filled(dilemma.outcome.stay)).toBe(true)
    if (dilemma.fact) {
      expect(filled(dilemma.fact.text)).toBe(true)
      expect(dilemma.fact.url).toMatch(/^https:\/\//)
      expect(dilemma.fact.source.length).toBeGreaterThan(0)
    }
    if (dilemma.verbs) {
      expect(filled(dilemma.verbs.pull)).toBe(true)
      expect(filled(dilemma.verbs.pulled)).toBe(true)
    }
  })

  it('only use poses the rig knows', () => {
    const actors: Actor[] = DILEMMAS.flatMap((dilemma) => [...dilemma.trackA, ...dilemma.trackB])
    for (const actor of actors) {
      if (actor.kind === 'person') expect(RIG.poses[actor.pose], actor.pose).toBeDefined()
    }
  })

  it('cite their research', () => {
    const cited = DILEMMAS.filter((dilemma) => dilemma.fact)
    expect(cited.length).toBeGreaterThanOrEqual(5)
  })
})

describe('the cast', () => {
  it('counts people and animals as lives, but not props', () => {
    expect(livesOf(INFLUENCERS)).toBe(5)
    expect(livesOf([{ kind: 'server' }, { kind: 'cat', coat: '#000', accent: '#fff' }])).toBe(1)
  })

  it('varies strangers and wraps around the roster', () => {
    const crowd = strangers(10, 3)
    expect(crowd).toHaveLength(10)
    expect(crowd[0]).not.toEqual(crowd[1])
    expect(crowd[0]).toEqual(crowd[8])
  })
})

describe('the copy', () => {
  it('reads Turkish percentages aloud for the right suffix', () => {
    const cases: [number, string][] = [
      [0, 'ı'], [1, 'i'], [2, 'si'], [3, 'ü'], [4, 'ü'], [5, 'i'], [6, 'sı'], [7, 'si'], [8, 'i'], [9, 'u'],
      [10, 'u'], [20, 'si'], [30, 'u'], [40, 'ı'], [50, 'si'], [60, 'ı'], [70, 'i'], [80, 'i'], [90, 'ı'], [100, 'ü'],
      [64, 'ü'], [81, 'i'], [51, 'i'], [72, 'si'], [36, 'sı'],
    ]
    for (const [value, suffix] of cases) expect(turkishPercentSuffix(value), String(value)).toBe(suffix)
  })

  it('formats percentages and counts per language', () => {
    expect(percent('tr', 64.4)).toBe('%64')
    expect(percent('en', 64.6)).toBe('65%')
    expect(count('tr', 1284)).toBe('1.284')
    expect(count('en', 1284)).toBe('1,284')
  })

  it('has every interface string and archetype in both languages', () => {
    const walk = (value: unknown): void => {
      if (value && typeof value === 'object' && 'tr' in value && 'en' in value) {
        expect(filled(value as Localized)).toBe(true)
        return
      }
      if (value && typeof value === 'object') Object.values(value).forEach(walk)
    }
    walk(UI)
    walk(ARCHETYPES)
  })
})
