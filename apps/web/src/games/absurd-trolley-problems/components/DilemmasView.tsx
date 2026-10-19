import { useEffect, useState, type ReactNode } from 'react'
import { choiceName, percent, playedCount, RESET_NOTES, UI } from '../content/strings'
import type { AnyChapter, AnyDilemma, Lang, TrolleyVoteId } from '../content/types'
import { pullShare, type Answers, type Tallies } from '../state/run'
import { PixelArrow, ResetArrow, ROUNDED_FONT, SegmentMeter } from './pixel'
import { PixelText } from './PixelText'
import { Avatar } from './StartScreen'

type DilemmasViewProps = {
  readonly lang: Lang
  /** The set on show: the absurd game's two chapters, or Foot's cases. */
  readonly chapters: readonly AnyChapter[]
  readonly title: string
  readonly intro: string
  /** What the chapter buttons say, when "chapter" is the wrong word. */
  readonly words?: { readonly resetChapter: string; readonly playChapter: string; readonly play: string }
  /** Something more on a played card (Foot's own answer). */
  readonly extra?: (dilemma: AnyDilemma) => ReactNode
  /** After the chapters (the essay's other cases). */
  readonly children?: ReactNode
  readonly answers: Answers
  readonly tallies: Tallies
  /** Whose game this is: the answers shown, and the ones a reset takes back. */
  readonly player: { readonly name: string; readonly color: string } | null
  readonly onSwitchPlayer: () => void
  /** A run is playing: nothing can be reset or restarted until it is over. */
  readonly busy?: boolean
  readonly onPlay: (id: TrolleyVoteId) => void
  readonly onReset: (id: TrolleyVoteId) => void
  readonly onResetChapter: (index: number) => void
  readonly onPlayChapter: (index: number) => void
}

/** How long a chapter's reset button waits for the second press. */
const CONFIRM_MS = 4000

/**
 * Every dilemma in a set (both absurd chapters, or Foot's cases), with the
 * player's choice and the community's split. A choice, or a whole chapter
 * of them, can be taken back here and played again.
 */
export function DilemmasView(props: DilemmasViewProps) {
  const { lang, chapters, title, intro, words, extra, children, answers, tallies, player, onSwitchPlayer, busy = false, onPlay, onReset, onResetChapter, onPlayChapter } = props
  // Resetting a chapter takes a second press, so twelve answers never go on a slip.
  const [confirming, setConfirming] = useState<number | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (confirming === null) return
    const timer = window.setTimeout(() => setConfirming(null), CONFIRM_MS)
    return () => window.clearTimeout(timer)
  }, [confirming])

  return (
    <div className="atp-list-view">
      <header className="atp-view-heading">
        <h2 className="atp-view-title">
          <PixelText text={title} family={ROUNDED_FONT} weight={800} artSize={16} fill={['#fff8e8', '#f7e7c6']} shadow="#060f22" align="left" />
        </h2>
        <p className="atp-view-intro">{intro}</p>
      </header>
      <div className="atp-whose">
        {player ? (
          <p className="atp-whose-name">
            <Avatar player={player} lang={lang} />
            <span>
              {UI.playingAs[lang]}: <strong>{player.name}</strong>
            </span>
          </p>
        ) : (
          <p className="atp-whose-name">{UI.noPlayerYet[lang]}</p>
        )}
        <button type="button" className="atp-chip" disabled={busy} onClick={onSwitchPlayer}>
          {player ? UI.switchPlayer[lang] : UI.newGame[lang]}
          <PixelArrow />
        </button>
      </div>
      <p className="sr-only" role="status">
        {note}
      </p>
      {chapters.map((chapter, chapterIndex) => {
        const played = chapter.dilemmas.filter((dilemma) => answers[dilemma.id as TrolleyVoteId]).length
        const isConfirming = confirming === chapterIndex
        return (
          <section key={chapter.id} className="atp-chapter" aria-labelledby={`atp-chapter-${chapter.id}`}>
            <div className="atp-chapter-head">
              <h3 id={`atp-chapter-${chapter.id}`} className="atp-chapter-title">
                {chapter.title[lang]}
              </h3>
              <p className="atp-chapter-count">{playedCount(lang, played, chapter.dilemmas.length)}</p>
              <div className="atp-chapter-actions">
                {played > 0 && (
                  <button
                    type="button"
                    className={`atp-chip is-reset ${isConfirming ? 'is-confirming' : ''}`}
                    disabled={busy}
                    aria-describedby={`atp-chapter-${chapter.id}`}
                    onClick={() => {
                      if (!isConfirming) {
                        setConfirming(chapterIndex)
                        setNote(RESET_NOTES.confirm(lang, player?.name ?? '', chapter.title[lang]))
                        return
                      }
                      setConfirming(null)
                      onResetChapter(chapterIndex)
                      setNote(RESET_NOTES.chapter(lang, player?.name ?? '', chapter.title[lang]))
                    }}
                  >
                    <ResetArrow />
                    {isConfirming ? UI.confirmReset[lang] : (words?.resetChapter ?? UI.resetChapter[lang])}
                  </button>
                )}
                <button type="button" className="atp-chip" disabled={busy} aria-describedby={`atp-chapter-${chapter.id}`} onClick={() => onPlayChapter(chapterIndex)}>
                  {played > 0 ? UI.playFromStart[lang] : (words?.playChapter ?? UI.playChapter[lang])}
                  <PixelArrow />
                </button>
              </div>
            </div>
            <ol className="atp-cards">
              {chapter.dilemmas.map((dilemma, index) => {
                // Numbered straight through the chapters.
                const number = chapters.slice(0, chapterIndex).reduce((sum, earlier) => sum + earlier.dilemmas.length, 0) + index + 1
                const id = dilemma.id as TrolleyVoteId
                const answer = answers[id]
                const share = answer ? pullShare(tallies[id]) : null
                const pulled = dilemma.verbs?.pulled[lang] ?? UI.pulledShort[lang]
                const titleId = `atp-card-${dilemma.id}`
                return (
                  <li key={dilemma.id} className="atp-card">
                    <span className="atp-card-number" aria-hidden="true">
                      {number.toString().padStart(2, '0')}
                    </span>
                    <h4 id={titleId} className="atp-card-title">
                      {dilemma.title[lang]}
                    </h4>
                    <p className="atp-card-setup">{dilemma.setup[lang]}</p>
                    <div className="atp-card-footer">
                      {answer ? (
                        <p className={`atp-badge ${answer === 'pull' ? 'is-pull' : 'is-stay'}`}>
                          {UI.yourChoice[lang]}: {choiceName(lang, dilemma, answer)}
                        </p>
                      ) : (
                        <p className="atp-badge">{UI.notPlayed[lang]}</p>
                      )}
                      {answer && extra?.(dilemma)}
                      {share !== null && (
                        <div className="atp-card-meter">
                          <SegmentMeter value={share} label={`${percent(lang, share * 100)} ${pulled}`} />
                          <span>{percent(lang, share * 100)}</span>
                        </div>
                      )}
                      <div className="atp-card-actions">
                        <button type="button" className="atp-card-play" aria-describedby={titleId} onClick={() => onPlay(id)}>
                          {answer ? UI.seeResult[lang] : (words?.play ?? UI.play[lang])}
                          <PixelArrow />
                        </button>
                        {answer && (
                          <button
                            type="button"
                            className="atp-card-reset"
                            disabled={busy}
                            aria-describedby={titleId}
                            onClick={() => {
                              onReset(id)
                              setNote(RESET_NOTES.dilemma(lang, player?.name ?? '', dilemma.title[lang]))
                            }}
                          >
                            <ResetArrow />
                            {UI.resetDilemma[lang]}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}
      {children}
    </div>
  )
}
