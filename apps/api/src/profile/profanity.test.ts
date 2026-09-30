import { describe, expect, it } from 'vitest'
import { isNicknameAllowed, normalizeForFilter } from './profanity'

describe('normalizeForFilter', () => {
  it('lowercases, folds accents and Turkish letters, maps leetspeak and strips non-letters', () => {
    expect(normalizeForFilter('F.U_C-K')).toBe('fuck')
    expect(normalizeForFilter('5h1t')).toBe('shit')
    expect(normalizeForFilter('@55 0 7')).toBe('assot')
    expect(normalizeForFilter('Şerefsiz Iğdır')).toBe('serefsizigdir')
    expect(normalizeForFilter('Mücahid 99')).toBe('mucahid')
  })
})

describe('isNicknameAllowed', () => {
  it('accepts ordinary names in any alphabet', () => {
    for (const nickname of ['Orb Master', 'Mücahid_07', 'Nazım', 'Classic Fan', 'Assassin', 'Amina', 'Scrapbook', 'Cocktail', 'Peacock']) {
      expect(isNicknameAllowed(nickname), nickname).toBe(true)
    }
  })

  it('rejects English profanity, even disguised', () => {
    for (const nickname of ['fuckface', 'F.U.C.K', 'Sh1tLord', 'b1tch', 'xX_wh0re_Xx']) {
      expect(isNicknameAllowed(nickname), nickname).toBe(false)
    }
  })

  it('rejects Turkish profanity, with or without Turkish letters', () => {
    for (const nickname of ['Şerefsiz', 'serefsiz', 'OROSPU', 'y4vş4k', 'amk', 'Siktir Git']) {
      expect(isNicknameAllowed(nickname), nickname).toBe(false)
    }
  })

  it('rejects short words only when they stand alone', () => {
    expect(isNicknameAllowed('ass')).toBe(false)
    expect(isNicknameAllowed('Big Ass')).toBe(false)
    expect(isNicknameAllowed('a.s.s')).toBe(false)
    expect(isNicknameAllowed('Nazi')).toBe(false)
    expect(isNicknameAllowed('Nazim')).toBe(true)
    expect(isNicknameAllowed('Bassist')).toBe(true)
  })
})
