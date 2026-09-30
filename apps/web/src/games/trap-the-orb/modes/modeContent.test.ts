import { CUSTOM_PRESETS, GAME_MODES } from '@games/trap-the-orb-engine'
import { describe, expect, it } from 'vitest'
import { describeLevelChange, matchingPreset, MODES, modeInfo, ruleChips, SPEED_TIER_INFO } from './modeContent'

describe('modes', () => {
  it('describes every game mode', () => {
    expect(MODES.map((mode) => mode.id)).toEqual(GAME_MODES)
    expect(modeInfo('hardcore').name).toBe('Hardcore')
    expect(() => modeInfo('turbo' as never)).toThrow(/unknown mode/i)
  })
})

describe('ruleChips', () => {
  it('summarises the fixed rules of the ranked modes', () => {
    expect(ruleChips('classic', null)).toEqual(['Lives reset each level', 'Clear at 75%'])
    expect(ruleChips('timeAttack', null)).toEqual(['Lives reset each level', 'Timer per level', 'Clear at 75%'])
    expect(ruleChips('limitedWalls', null)).toEqual(['Lives reset each level', 'Wall budget', 'Clear at 75%'])
    expect(ruleChips('hardcore', null)).toEqual(['1 life per run', 'Clear at 75%'])
  })

  it('flags practice modes as unranked', () => {
    expect(ruleChips('zen', null)).toEqual(['∞ lives', 'Clear at 75%', 'Not ranked'])
  })

  it('spells out a Custom setup', () => {
    expect(ruleChips('custom', CUSTOM_PRESETS.hard)).toEqual([
      '5 orbs',
      '1.3× speed',
      '3 lives',
      '120s timer',
      '16 walls',
      'Clear at 80%',
      'Not ranked',
    ])
    expect(ruleChips('custom', CUSTOM_PRESETS.easy)).toContain('∞ lives')
  })
})

describe('matchingPreset', () => {
  it('recognises the presets and nothing else', () => {
    expect(matchingPreset(CUSTOM_PRESETS.expert)).toBe('expert')
    expect(matchingPreset({ ...CUSTOM_PRESETS.expert, orbCount: 7 })).toBeNull()
  })
})

describe('describeLevelChange', () => {
  it('says what the next level brings', () => {
    expect(describeLevelChange([], { orbTiers: [0], change: 'first' })).toMatch(/warm up/)
    expect(describeLevelChange([0], { orbTiers: [0, 0], change: 'newOrb' })).toBe('A new orb joins the field.')
    expect(describeLevelChange([1, 1], { orbTiers: [0, 0, 0], change: 'breather' })).toMatch(/ease off/)
    expect(describeLevelChange([0], { orbTiers: [0], change: 'repeat' })).toMatch(/fresh layout/)
  })

  it('counts the orbs that speed up', () => {
    expect(describeLevelChange([0, 0], { orbTiers: [1, 0], change: 'speedUp' })).toBe('One orb gets faster.')
    expect(describeLevelChange([1, 1, 1, 1, 1], { orbTiers: [2, 2, 1, 1, 1], change: 'speedUp' })).toBe(
      '2 orbs get faster.',
    )
    expect(describeLevelChange([], { orbTiers: [1, 1], change: 'speedUp' })).toBe('The orbs get faster.')
  })
})

describe('speed tiers', () => {
  it('names the four speeds with the canvas colours', () => {
    expect(SPEED_TIER_INFO.map((tier) => tier.name)).toEqual(['Calm', 'Quick', 'Fast', 'Blazing'])
    expect(SPEED_TIER_INFO[0]?.color).toBe('#2b8cff')
  })
})
