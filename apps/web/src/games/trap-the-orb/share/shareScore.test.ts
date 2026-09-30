import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildShareText, shareScore } from './shareScore'

afterEach(() => {
  vi.unstubAllGlobals()
})

const stubNavigator = (overrides: Partial<Navigator>) =>
  vi.stubGlobal('navigator', { ...navigator, ...overrides } as Navigator)

describe('buildShareText', () => {
  it('describes the run in one friendly sentence', () => {
    expect(buildShareText({ score: 12_450, level: 7 })).toBe(
      'I reached level 7 with 12,450 points in Trap The Orb. Can you beat it?',
    )
  })

  it('names the mode when given', () => {
    expect(buildShareText({ score: 800, level: 3, modeName: 'Hardcore' })).toBe(
      'I reached level 3 with 800 points in Trap The Orb (Hardcore). Can you beat it?',
    )
  })
})

describe('shareScore', () => {
  const run = { score: 900, level: 2 }

  it('uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ share })

    await expect(shareScore(run, 'https://traptheorb.com')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({
      title: 'Trap The Orb',
      text: buildShareText(run),
      url: 'https://traptheorb.com',
    })
  })

  it('treats a dismissed share sheet as a cancel, not an error', async () => {
    stubNavigator({ share: vi.fn().mockRejectedValue(new DOMException('Share canceled', 'AbortError')) })

    await expect(shareScore(run, 'https://traptheorb.com')).resolves.toBe('cancelled')
  })

  it('falls back to copying the text and link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ share: undefined, clipboard: { writeText } as unknown as Clipboard })

    await expect(shareScore(run, 'https://traptheorb.com')).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith(`${buildShareText(run)} https://traptheorb.com`)
  })

  it('reports failure when neither sharing nor copying works', async () => {
    stubNavigator({
      share: undefined,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } as unknown as Clipboard,
    })

    await expect(shareScore(run, 'https://traptheorb.com')).resolves.toBe('failed')
  })
})
