import { FOOT_DILEMMA_IDS } from '@games/contract'
import { describe, expect, it } from 'vitest'
import { FOOT_ANSWERS, FOOT_CASES, FOOT_CHAPTER, FOOT_DILEMMAS, FOOT_PRINCIPLES, FOOT_SOURCE, footCaseTitle, OTHER_FOOT_CASES } from './foot'
import { choiceName, FOOT_UI, MODES } from './strings'
import type { Localized } from './types'

const filled = (copy: Localized): boolean => copy.tr.trim().length > 0 && copy.en.trim().length > 0

describe("Philippa Foot's cases", () => {
  it('cover the whole essay, each once, in both languages', () => {
    expect(FOOT_CASES.length).toBeGreaterThanOrEqual(24)
    expect(new Set(FOOT_CASES.map((footCase) => footCase.id)).size).toBe(FOOT_CASES.length)
    for (const footCase of FOOT_CASES) {
      expect(filled(footCase.title)).toBe(true)
      expect(filled(footCase.summary)).toBe(true)
      expect(filled(footCase.verdict)).toBe(true)
    }
    // Every choice in the essay is played; the rest are listed.
    expect(FOOT_CASES.filter((footCase) => footCase.play).map((footCase) => footCase.play).sort()).toEqual([...FOOT_DILEMMA_IDS].sort())
    expect(OTHER_FOOT_CASES.map((footCase) => footCase.id)).toEqual(['relatives', 'far-away', 'allowing'])
  })

  it('are the ones the API takes votes on, played as one chapter', () => {
    expect(FOOT_DILEMMAS.map((dilemma) => dilemma.id)).toEqual([...FOOT_DILEMMA_IDS])
    expect(FOOT_CHAPTER.dilemmas).toBe(FOOT_DILEMMAS)
  })

  it.each(FOOT_DILEMMAS.map((dilemma) => [dilemma.id, dilemma] as const))('%s is written in both languages, with Foot’s reasoning', (_id, dilemma) => {
    expect(filled(dilemma.title)).toBe(true)
    expect(filled(dilemma.setup)).toBe(true)
    expect(filled(dilemma.outcome.pull)).toBe(true)
    expect(filled(dilemma.outcome.stay)).toBe(true)
    expect(dilemma.fact).toMatchObject(FOOT_SOURCE)
    if (dilemma.uncounted) {
      // The abortion debate's operations count nobody: the scene draws its own patient.
      expect([...dilemma.trackA, ...dilemma.trackB]).toEqual([])
    } else {
      // Someone is lost if you act; doing nothing can cost no one (pouring the oil away, shelving the reform).
      expect(dilemma.trackB.length).toBeGreaterThan(0)
    }
    expect(filled(footCaseTitle(dilemma.id) ?? { tr: '', en: '' })).toBe(true)
    const { verbs } = dilemma
    expect(verbs && filled(verbs.pull) && filled(verbs.pulled)).toBe(true)
    expect(verbs?.stay && filled(verbs.stay)).toBe(true)
    expect(verbs?.you && filled(verbs.you.pull) && filled(verbs.you.stay)).toBe(true)
  })

  it('knows where Foot comes down, and that she leaves the cave open only with his head outside', () => {
    expect(Object.keys(FOOT_ANSWERS).sort()).toEqual([...FOOT_DILEMMA_IDS].sort())
    expect(FOOT_ANSWERS['foot-driver']).toBe('pull')
    expect(FOOT_ANSWERS['foot-judge']).toBe('stay')
    expect(FOOT_ANSWERS['foot-crash']).toBe('pull')
    expect(FOOT_ANSWERS['foot-beggar']).toBe('stay')
    expect(FOOT_ANSWERS['foot-children']).toBe('stay')
    expect(FOOT_ANSWERS['foot-oil']).toBe('stay')
    expect(FOOT_ANSWERS['foot-education']).toBe('pull')
    expect(FOOT_ANSWERS['foot-cave']).toBeNull()
    expect(FOOT_ANSWERS['foot-cave-inside']).toBe('pull')
    expect(FOOT_ANSWERS['foot-lifeboat']).toBe('pull')
    expect(FOOT_ANSWERS['foot-hysterectomy']).toBe('pull')
    expect(FOOT_ANSWERS['foot-craniotomy']).toBe('pull')
    expect(FOOT_ANSWERS['foot-mother-or-child']).toBe('pull')
    expect(FOOT_ANSWERS['foot-worst-dilemma']).toBeNull()
  })

  it('count nobody in the abortion debate’s operations, and say why', () => {
    const operations = FOOT_DILEMMAS.filter((dilemma) => dilemma.uncounted).map((dilemma) => dilemma.id)
    expect(operations).toEqual(['foot-hysterectomy', 'foot-craniotomy', 'foot-mother-or-child', 'foot-worst-dilemma'])
    expect(FOOT_PRINCIPLES.find((principle) => principle.id === 'abortion')?.cases).toEqual(operations)
    expect(filled(FOOT_UI.uncounted)).toBe(true)
  })

  it('drown everyone, the one too, when nobody acts in the cave (head inside) and the lifeboat', () => {
    for (const id of ['foot-cave-inside', 'foot-lifeboat']) {
      const dilemma = FOOT_DILEMMAS.find((each) => each.id === id)
      expect(dilemma?.trackA).toContain(dilemma?.trackB[0])
      expect(dilemma?.trackA).toHaveLength(6)
    }
  })

  it('sort every case into exactly one of Foot’s distinctions, each with her rule', () => {
    const grouped = FOOT_PRINCIPLES.flatMap((principle) => principle.cases)
    expect([...grouped].sort()).toEqual([...FOOT_DILEMMA_IDS].sort())
    for (const principle of FOOT_PRINCIPLES) {
      expect(filled(principle.title) && filled(principle.rule)).toBe(true)
      const answers = new Set(principle.cases.map((id) => FOOT_ANSWERS[id]))
      // Harm against harm, aid against aid and the hopeless cases: act. Harm for aid: refuse. Open: no answer.
      if (principle.id === 'harms' || principle.id === 'aid' || principle.id === 'no-one-spared') expect(answers).toEqual(new Set(['pull']))
      if (principle.id === 'harm-for-aid') expect(answers).toEqual(new Set(['stay']))
      if (principle.id === 'open') expect(answers).toEqual(new Set([null]))
      // The operations: act where both would die, take no side in the worst dilemma.
      if (principle.id === 'abortion') expect(answers).toEqual(new Set(['pull', null]))
    }
  })

  it('names each choice by its own buttons', () => {
    const [driver] = FOOT_DILEMMAS
    if (!driver) throw new Error('no cases')
    expect(choiceName('en', driver, 'pull')).toBe('Steer away')
    expect(choiceName('tr', driver, 'stay')).toBe('Düz devam et')
  })

  it('are introduced in both languages', () => {
    expect(MODES.foot.meta('tr', 3, 10)).toBe('3 / 10 vaka oynandı')
    expect(MODES.absurd.meta('en', 2, 24)).toBe('2 of 24 dilemmas played')
    expect(FOOT_UI.eyebrow('tr', 1, 10)).toBe('Philippa Foot · 1967 · Vaka 1 / 10')
    expect(FOOT_UI.agreement('tr', 4, 9)).toBe('Foot’un cevap verdiği 9 vakanın 4 tanesinde onunla aynı yolu seçtin.')
    expect(FOOT_UI.agreement('en', 4, 9)).toBe('You sided with Foot on 4 of the 9 cases she answered.')
  })
})
