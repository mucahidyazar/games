import { formatNumber } from '@/lib/format'
import { logger } from '@/lib/logger'

export interface SharedRun {
  readonly score: number
  readonly level: number
  /** Shown in brackets after the game title, e.g. "Time Attack". */
  readonly modeName?: string
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

const GAME_TITLE = 'Trap The Orb'

export function buildShareText({ score, level, modeName }: SharedRun): string {
  const game = modeName ? `${GAME_TITLE} (${modeName})` : GAME_TITLE
  return `I reached level ${level} with ${formatNumber(score)} points in ${game}. Can you beat it?`
}

const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError'

/** Shares a finished run via the native share sheet, or copies it to the clipboard. */
export async function shareScore(run: SharedRun, url: string): Promise<ShareOutcome> {
  const text = buildShareText(run)

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: GAME_TITLE, text, url })
      return 'shared'
    } catch (error: unknown) {
      if (isAbort(error)) return 'cancelled'
      logger.warn('Native share failed, falling back to the clipboard', error)
    }
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`)
    return 'copied'
  } catch (error: unknown) {
    logger.warn('Could not copy the score to the clipboard', error)
    return 'failed'
  }
}
