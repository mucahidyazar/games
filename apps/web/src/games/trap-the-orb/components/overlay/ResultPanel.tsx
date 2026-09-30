import type { FinishRunResponse, RecordUpdate } from '@games/contract'
import { isRankedMode, type GameOverReason } from '@games/trap-the-orb-engine'
import { useId, useState, type FormEvent } from 'react'
import { Link } from '@/app/Link'
import { CheckIcon, PlayIcon, ShareIcon, TrophyIcon } from '@/components/icons'
import { BadgeMedal } from '@/games/trap-the-orb/badges/BadgeMedal'
import { badgeContent, TIER_NAMES } from '@/games/trap-the-orb/badges/badgeContent'
import {
  BOARD_CONTENT,
  formatBoardValue,
  leaderboardsHref,
  PERIOD_LABELS,
  scoreBoardFor,
} from '@/games/trap-the-orb/leaderboards/boardContent'
import type { ApiError } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import { siteConfig } from '@/lib/site'
import { gamePaths } from '../../game'
import { modeInfo } from '../../modes/modeContent'
import type { RunResult } from '../../run/useRunFlow'
import { shareScore, type ShareOutcome } from '../../share/shareScore'
import { usePlayerData } from '../../state/playerDataContext'
import { qualifiesForHighScores } from '../../storage/scores'
import { MAX_NICKNAME_LENGTH } from '../../storage/settings'
import { ActionButton, Eyebrow, Note, Panel, Spinner, TextButton } from './Panel'
import { useFocusOnMount } from './useFocusOnMount'
import type { OverlayProps } from './types'

const REASON_TEXT: Readonly<Record<GameOverReason, string>> = {
  lives: 'Out of lives',
  time: 'Time’s up',
  walls: 'Out of walls',
}

function headline(result: RunResult, reason: GameOverReason | null): string {
  if (result.endedEarly) return 'Run ended'
  return reason ? REASON_TEXT[reason] : 'Game over'
}

/** Only network hiccups, rate limits and server errors are worth retrying; a rejected replay stays rejected. */
const canRetry = (error: ApiError): boolean => error.status === 0 || error.status === 429 || error.status >= 500

const FINISH_ERRORS: Readonly<Partial<Record<string, string>>> = {
  unauthorized: 'you were signed out',
  run_expired: 'the run stayed open for too long',
  run_not_active: 'this run was already submitted',
  run_not_found: 'the run could not be found',
  run_implausible: 'the recording didn’t add up',
  invalid_run: 'the recording didn’t add up',
  payload_too_large: 'the recording was too large',
  rate_limited: 'too many runs were sent at once',
}

function failureText(error: ApiError): string {
  const known = FINISH_ERRORS[error.code]
  if (known) return known
  if (canRetry(error)) return 'the server can’t be reached right now'
  return error.message.replace(/\.$/, '').toLowerCase()
}

function RecordRow({ record }: { readonly record: RecordUpdate }) {
  const board = BOARD_CONTENT[record.board]
  const isScore = record.board.startsWith('score.')
  return (
    <li className="flex items-center gap-2 py-1.5">
      <TrophyIcon className="size-4 shrink-0 text-[#f5b83d]" />
      <span className="min-w-0 flex-1 truncate text-left text-ink-soft">
        {isScore ? `${board.name} · ${PERIOD_LABELS[record.period].toLowerCase()}` : board.name}
        {!isScore && <span className="text-subtle"> · {formatBoardValue(record.board, record.value)}</span>}
      </span>
      <span className="tabular font-bold text-teal-700">#{formatNumber(record.rank)}</span>
    </li>
  )
}

function VerifiedSummary({ response }: { readonly response: FinishRunResponse }) {
  if (!response.ranked) {
    return <Note>Practice attempt — only your first Daily Challenge attempt each day is ranked.</Note>
  }
  const records = response.records.filter((record) => record.improved)

  return (
    <div className="mt-3 space-y-3 text-[0.8rem]">
      {records.length > 0 ? (
        <section aria-label="New personal bests" className="rounded-[10px] bg-page px-3 py-1.5">
          <ul className="divide-y divide-divider">
            {records.map((record) => (
              <RecordRow key={record.key} record={record} />
            ))}
          </ul>
        </section>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-muted">
          <CheckIcon className="size-3.5 text-teal-700" /> Verified — no new personal best this time.
        </p>
      )}
      {response.newBadges.length > 0 && (
        <section aria-labelledby="new-badges-title">
          <h3 id="new-badges-title" className="text-[0.68rem] font-bold tracking-[0.12em] text-danger uppercase">
            New {response.newBadges.length === 1 ? 'badge' : 'badges'}
          </h3>
          <ul className="mt-2 flex flex-wrap justify-center gap-3">
            {response.newBadges.map((badge) => (
              <li key={badge.id} className="flex w-[72px] flex-col items-center gap-1 text-center">
                <BadgeMedal id={badge.id} tier={badge.tier} />
                <span className="text-[0.68rem] leading-tight font-semibold text-ink-soft">
                  {badgeContent(badge.id).name}
                  <span className="block font-medium text-subtle">{TIER_NAMES[badge.tier]}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function DeviceScoreForm({ result }: { readonly result: RunResult }) {
  const nameId = useId()
  const { store, settings, highScores } = usePlayerData()
  const [name, setName] = useState(settings.nickname)
  const [savedRank, setSavedRank] = useState<number | null>(null)

  if (savedRank !== null) {
    return (
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-[0.78rem] font-bold text-teal-800">
        <CheckIcon className="size-3.5" /> Saved — #{savedRank} on this device
      </p>
    )
  }
  if (!qualifiesForHighScores(highScores, result.mode, result.score)) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setSavedRank(store.submitHighScore({ name, mode: result.mode, score: result.score, level: result.level }))
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex gap-2 text-left">
      <label htmlFor={nameId} className="sr-only">
        Your name for this device’s high scores
      </label>
      <input
        id={nameId}
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={MAX_NICKNAME_LENGTH}
        placeholder="Your name"
        autoComplete="nickname"
        className="h-10 min-w-0 flex-1 rounded-(--radius-control) border border-line-strong bg-surface px-3 text-[0.9rem] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-subtle focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15"
      />
      <ActionButton type="submit" variant="secondary">
        Save
      </ActionButton>
    </form>
  )
}

function VerificationBlock({ result, flow, onOpenDialog }: Pick<OverlayProps, 'flow' | 'onOpenDialog'> & { readonly result: RunResult }) {
  const { verification } = result
  switch (verification.status) {
    case 'pending':
      return (
        <p role="status" className="mt-3 inline-flex items-center gap-2 text-[0.8rem] text-muted">
          <Spinner className="size-3.5" /> Verifying your run…
        </p>
      )
    case 'verified':
      return <VerifiedSummary response={verification.response} />
    case 'failed':
      return (
        <Note tone="alert">
          We couldn’t verify this run: {failureText(verification.error)}.
          {canRetry(verification.error) && (
            <>
              {' '}
              <TextButton onClick={() => flow.retrySubmit()}>Try again</TextButton>
            </>
          )}
        </Note>
      )
    case 'local':
      switch (verification.reason) {
        case 'casual':
          return <Note>Practice mode — not ranked.</Note>
        case 'submittedOnExit':
          return <Note>This run was sent when you left the page. Check the leaderboards for your rank.</Note>
        case 'offline':
          return (
            <>
              <DeviceScoreForm result={result} />
              <Note>Played without a connection, so this run wasn’t ranked.</Note>
            </>
          )
        case 'guest':
          return (
            <>
              <DeviceScoreForm result={result} />
              <Note>
                <TextButton onClick={() => onOpenDialog('account')}>Sign in</TextButton> to put scores like this on the
                leaderboards.
              </Note>
            </>
          )
      }
  }
}

type ResultPanelProps = OverlayProps & { readonly result: RunResult }

export function ResultPanel({ result, hud, flow, onBackToReady, onOpenDialog, onAfterAction }: ResultPanelProps) {
  const titleId = useId()
  const playAgainRef = useFocusOnMount<HTMLButtonElement>()
  const [shareOutcome, setShareOutcome] = useState<ShareOutcome | null>(null)
  const mode = modeInfo(result.mode)
  const board = scoreBoardFor(result.mode)
  const reason =
    result.verification.status === 'verified' ? result.verification.response.result.gameOverReason : hud.gameOverReason

  return (
    <Panel labelledBy={titleId}>
      <Eyebrow>
        {headline(result, reason)} · {mode.name}
      </Eyebrow>
      <h2 id={titleId} className="tabular mt-1.5 text-[1.9rem] leading-none font-extrabold tracking-[-0.03em]">
        {formatNumber(result.score)}
      </h2>
      <p className="mt-1.5 text-[0.82rem] text-muted">
        {result.score === 1 ? 'point' : 'points'} · level {result.level}
      </p>

      <VerificationBlock result={result} flow={flow} onOpenDialog={onOpenDialog} />

      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
        <ActionButton
          ref={playAgainRef}
          isBusy={flow.isStarting}
          onClick={() => {
            flow.start()
            onAfterAction()
          }}
        >
          {flow.isStarting ? <Spinner /> : <PlayIcon className="size-4" />} Play again
        </ActionButton>
        <ActionButton variant="secondary" onClick={onBackToReady}>
          {result.mode === 'custom' ? 'Change setup' : 'Change mode'}
        </ActionButton>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => {
            void shareScore(
              { score: result.score, level: result.level, modeName: mode.name },
              `${siteConfig.url}${gamePaths.home()}`,
            ).then(setShareOutcome)
          }}
          className="inline-flex items-center gap-1.5 rounded-sm text-[0.8rem] font-semibold text-teal-700 underline-offset-4 hover:underline"
        >
          <ShareIcon className="size-4" /> Share
        </button>
        {board && isRankedMode(result.mode) && (
          <Link
            href={leaderboardsHref(board)}
            className="rounded-sm text-[0.8rem] font-semibold text-teal-700 underline-offset-4 hover:underline"
          >
            Leaderboards
          </Link>
        )}
      </div>
      <p role="status" className="min-h-[1.1rem] text-[0.74rem] text-muted">
        {shareOutcome === 'copied' && 'Copied — paste it anywhere to challenge a friend.'}
        {shareOutcome === 'failed' && 'Sharing isn’t available here.'}
      </p>
    </Panel>
  )
}
