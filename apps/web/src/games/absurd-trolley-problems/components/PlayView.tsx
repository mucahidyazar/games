import type { TrolleyTally } from '@games/contract'
import type { ComponentType, ReactNode, Ref } from 'react'
import { count, FOOT_UI, percent, turkishPercentSuffix, UI } from '../content/strings'
import type { Actor, AnyDilemma, Lang, TrolleyChoice } from '../content/types'
import type { SceneEvent, SceneEventDetail } from '../scene/TrolleyScene'
import { pullShare, totalVotes } from '../state/run'
import { GrassTuft, KeyCap, PixelArrow, ROUNDED_FONT, SegmentMeter, Skull, Sparkle } from './pixel'
import { PixelText } from './PixelText'
import { Stage, type StageHandle, type StageProps } from './Stage'

export type Phase = 'deciding' | 'running' | 'result'

export interface Community {
  /** The tally to show (including the player's own vote), or null when unavailable. */
  readonly tally: TrolleyTally | null
  readonly status: 'loading' | 'ready' | 'error'
}

type PlayViewProps = {
  readonly stageRef: Ref<StageHandle>
  readonly lang: Lang
  readonly dilemma: AnyDilemma | null
  readonly trackA: readonly Actor[]
  readonly answer: TrolleyChoice | null
  readonly phase: Phase
  readonly isLast: boolean
  readonly community: Community
  /** Lives lost to the player's choices so far; it ticks up as the tram hits. */
  readonly kills: number
  readonly reducedMotion: boolean
  readonly onChoose: (choice: TrolleyChoice) => void
  readonly onNext: () => void
  readonly onSceneEvent: (event: SceneEvent, detail?: SceneEventDetail) => void
  /** Shown over the stage instead of a dilemma: the start screen, or a chapter's summary. */
  readonly overlay?: Overlay
  /** Whose game is on, shown by the kill count; clicking it brings back the start screen. */
  readonly player?: { readonly name: string; readonly color: string } | null
  readonly onSwitchPlayer?: () => void
  /** Rebuilds the set when it changes (another player's game on the same dilemma). */
  readonly setKey?: string
  /** Draws the scene another way (Philippa Foot's problems in motion); the 3D stage by default. */
  readonly stage?: ComponentType<StageProps>
  /** A line over the title: which set and case this is. */
  readonly eyebrow?: string
  /** Sets the title in the book face instead of pixels. */
  readonly bookTitle?: boolean
  /** Heads the research once the choice is made (Philippa Foot's own answer). */
  readonly verdict?: ReactNode
  /** Counts victims rather than kills (some of Foot's cases hurt without killing). */
  readonly victims?: boolean
  readonly nextLabel?: string
  readonly hint?: string
  /** Back to choosing which problems to play, from a chip by the kill count. */
  readonly onChangeSet?: () => void
}

export interface Overlay {
  readonly kind: 'start' | 'summary'
  readonly title: string
  readonly setup: string
  readonly content: ReactNode
}

function communityLine(lang: Lang, dilemma: AnyDilemma, tally: TrolleyTally): string {
  const share = pullShare(tally) ?? 0
  const value = Math.round(share * 100)
  const verb = dilemma.verbs?.pulled[lang] ?? UI.pulledVerb[lang]
  return lang === 'tr' ? `Topluluğun %${value}’${turkishPercentSuffix(value)} ${verb}.` : `${value}% of the community ${verb}.`
}

/** The play tab: question, scene (with what everyone else did over it) and the two choices. */
export function PlayView(props: PlayViewProps) {
  const { stageRef, lang, dilemma, trackA, answer, phase, isLast, community, kills, reducedMotion, onChoose, onNext, onSceneEvent, overlay, player, onSwitchPlayer, setKey } = props
  const { stage: SceneStage = Stage, eyebrow, bookTitle = false, verdict, victims = false, nextLabel = UI.next[lang], hint = UI.keyHint[lang], onChangeSet } = props
  const tallyWord = victims ? FOOT_UI.victims[lang] : UI.kills[lang]
  const tallyLabel = victims ? FOOT_UI.victimCount[lang] : UI.killCount[lang]
  const decided = phase !== 'deciding'
  const showResult = phase === 'result' && answer !== null && dilemma !== null
  const pullLabel = dilemma?.verbs?.pull[lang] ?? UI.pull[lang]
  const stayLabel = dilemma?.verbs?.stay?.[lang] ?? UI.stay[lang]
  const tally = community.tally
  const share = showResult && tally ? pullShare(tally) : null
  const votes = totalVotes(tally ?? undefined)

  let note: string
  if (!showResult) note = UI.beforeChoice[lang]
  else if (community.status === 'error' && !tally) note = UI.noCommunity[lang]
  else if (!tally) note = UI.waitingVote[lang]
  else note = communityLine(lang, dilemma, tally)

  const ownYou = answer ? dilemma?.verbs?.you?.[answer][lang] : undefined
  const youLine = ownYou ?? (answer === 'stay' ? UI.youStayed[lang] : dilemma?.special === 'footbridge' ? UI.youPushed[lang] : UI.youPulled[lang])
  const title = (overlay ? overlay.title : dilemma?.title[lang]) ?? ''

  return (
    <div className="atp-play" data-phase={overlay ? overlay.kind : phase}>
      <hgroup className={`atp-heading ${bookTitle ? 'is-book' : ''}`}>
        {eyebrow && !overlay && <p className="atp-eyebrow">{eyebrow}</p>}
        <h2 className="atp-title" aria-live="polite">
          <Sparkle className="atp-title-sparkle is-left" />
          {bookTitle ? (
            <span className="atp-title-text atp-title-book">{title}</span>
          ) : (
            <PixelText className="atp-title-text" text={title} family={ROUNDED_FONT} weight={800} artSize={17} fill={['#fff8e8', '#f7e7c6']} shadow="#060f22" parentReserve={120} />
          )}
          <Sparkle className="atp-title-sparkle is-right" />
        </h2>
        <p className="atp-setup">{overlay ? overlay.setup : dilemma?.setup[lang]}</p>
        {!overlay && dilemma?.uncounted && <p className="atp-setup-note">{FOOT_UI.uncounted[lang]}</p>}
      </hgroup>

      {/* A summary takes the stage's place in the flow, the scene dimmed behind it, so it is never cut short. */}
      <div className={`atp-stage-wrap ${overlay?.kind === 'summary' ? 'has-summary' : ''}`}>
        <SceneStage
          ref={stageRef}
          dilemma={dilemma}
          trackA={trackA}
          settled={answer}
          lang={lang}
          reducedMotion={reducedMotion}
          interactive={phase === 'deciding' && !overlay && dilemma !== null && dilemma.special !== 'footbridge'}
          onLever={onChoose}
          setKey={setKey}
          onEvent={onSceneEvent}
        >
          {overlay && <div className={`atp-stage-dim ${overlay.kind === 'start' ? 'is-deep' : ''}`} aria-hidden="true" />}
        </SceneStage>
        {overlay?.content}
        {overlay?.kind !== 'start' && (
          <div className="atp-hud">
            {onChangeSet && (
              <button type="button" className="atp-player-chip atp-set-chip" onClick={onChangeSet} aria-label={FOOT_UI.changeSetLabel[lang]} title={FOOT_UI.changeSetLabel[lang]}>
                <PixelArrow className="is-back" />
                <span className="atp-player-chip-name">{FOOT_UI.changeSet[lang]}</span>
              </button>
            )}
            {player && (
              <button type="button" className="atp-player-chip" onClick={onSwitchPlayer} aria-label={`${UI.switchPlayer[lang]} (${player.name})`} title={UI.switchPlayer[lang]}>
                <span className="atp-player-dot" aria-hidden="true" style={{ background: player.color }} />
                <span className="atp-player-chip-name">{player.name}</span>
              </button>
            )}
            <p className="atp-kills" aria-label={`${tallyLabel}: ${kills}`} title={tallyLabel}>
              <Skull />
              <span key={kills} className="atp-kills-value" aria-hidden="true">
                {kills}
              </span>
              <span className="atp-kills-label" aria-hidden="true">
                {tallyWord}
              </span>
            </p>
          </div>
        )}
        {showResult && dilemma && !overlay && (
          <p className="atp-quip" role="status">
            <span className="atp-quip-you">{youLine}</span> {dilemma.outcome[answer][lang]}
          </p>
        )}
        <GrassTuft className="atp-grass-left" />
        <GrassTuft className="atp-grass-right" flip />
      </div>

      {!overlay && dilemma && (
        <>
          {/* Over the scene: the research and what everyone else did at the bottom, the way on in the corner. */}
          <div className="atp-dock">
            {showResult && dilemma.fact && (
              <aside className="atp-fact" aria-label={verdict ? FOOT_UI.footSays[lang] : UI.research[lang]}>
                <p className="atp-fact-label">{verdict ? FOOT_UI.footSays[lang] : UI.research[lang]}</p>
                {verdict}
                <p className="atp-fact-text">{dilemma.fact.text[lang]}</p>
                <a className="atp-fact-source" href={dilemma.fact.url} target="_blank" rel="noopener noreferrer">
                  {dilemma.fact.source}
                </a>
              </aside>
            )}
            <div className="atp-community">
              <div className="atp-community-meter">
                <SegmentMeter value={share} label={note} />
                <span className="atp-pct" aria-hidden="true">
                  {share === null ? (lang === 'tr' ? '%--' : '--%') : percent(lang, share * 100)}
                </span>
              </div>
              <p className="atp-community-text" aria-live="polite">
                {note}
                {showResult && tally && votes > 0 && (
                  <span className="atp-votes"> · {votes === 1 ? UI.firstVote[lang] : `${count(lang, votes)} ${UI.votes[lang]}`}</span>
                )}
              </p>
            </div>
          </div>
          <button type="button" className="atp-next" disabled={phase !== 'result'} onClick={onNext} aria-keyshortcuts="Enter">
            {isLast ? UI.finish[lang] : nextLabel}
            <PixelArrow />
          </button>

          <div className="atp-choices" role="group" aria-label={dilemma.title[lang]}>
            <KeyCap className="atp-key-left">A</KeyCap>
            <button
              type="button"
              className="atp-choice is-pull"
              disabled={decided}
              aria-pressed={answer === 'pull'}
              aria-keyshortcuts="A"
              data-chosen={answer === 'pull' ? 'yes' : answer ? 'no' : undefined}
              onClick={() => onChoose('pull')}
            >
              <PixelText text={pullLabel} family={ROUNDED_FONT} weight={800} artSize={13} fill="#0d2a1e" singleLine />
              <PixelArrow />
            </button>
            <button
              type="button"
              className="atp-choice is-stay"
              disabled={decided}
              aria-pressed={answer === 'stay'}
              aria-keyshortcuts="D"
              data-chosen={answer === 'stay' ? 'yes' : answer ? 'no' : undefined}
              onClick={() => onChoose('stay')}
            >
              <PixelText text={stayLabel} family={ROUNDED_FONT} weight={800} artSize={13} fill="#2a1906" singleLine />
              <PixelArrow />
            </button>
            <KeyCap className="atp-key-right">D</KeyCap>
          </div>

          <p className="atp-hint">{hint}</p>
        </>
      )}
    </div>
  )
}
