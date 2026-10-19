import { useId, useMemo, useState } from 'react'
import { agreementLine, ARCHETYPES, choiceName, count, FOOT_PROFILES, FOOT_UI, livesLine, sharedLine, UI, VERDICTS } from '../content/strings'
import type { AnyChapter, AnyDilemma, Lang, TrolleyVoteId } from '../content/types'
import { compareAnswers, footProfile, type Comparable, type PlayerTotals } from '../state/compare'
import type { Tallies } from '../state/run'
import { Avatar } from './StartScreen'
import { PixelArrow, ROUNDED_FONT } from './pixel'
import { PixelText } from './PixelText'

type CompareViewProps = {
  readonly lang: Lang
  /** Who can be compared, most recent first: the players here (and, for Foot's cases, Foot herself). */
  readonly people: readonly Comparable[]
  /** Whose game is on: picked first. */
  readonly activeId: string | null
  /** The set being compared. */
  readonly chapters: readonly AnyChapter[]
  readonly intro: string
  readonly tallies: Tallies
  /** Philippa Foot's cases: victims rather than lives, first options rather than levers, her profiles rather than the absurd ones. */
  readonly foot?: boolean
  readonly onNewGame: () => void
}

function Totals({ lang, player, totals, foot }: { readonly lang: Lang; readonly player: Comparable; readonly totals: PlayerTotals; readonly foot: boolean }) {
  const { summary, kills } = totals
  const footProfileId = foot ? footProfile(player.answers) : null
  let profile = '—'
  if (foot) profile = footProfileId ? FOOT_PROFILES[footProfileId].title[lang] : '—'
  else if (summary.answered > 0) profile = ARCHETYPES[summary.archetype].title[lang]
  return (
    <div className="atp-vs-totals">
      <p className="atp-vs-name">
        <Avatar player={player} lang={lang} />
        {player.name}
      </p>
      <dl>
        <div>
          <dt>{foot ? FOOT_UI.victims[lang] : UI.livesLost[lang]}</dt>
          <dd>{count(lang, kills)}</dd>
        </div>
        <div>
          <dt>{foot ? FOOT_UI.firstOption[lang] : UI.leverPulls[lang]}</dt>
          <dd>
            {summary.pulls} / {summary.answered}
          </dd>
        </div>
        <div>
          <dt>{UI.moralProfile[lang]}</dt>
          <dd>{profile}</dd>
        </div>
      </dl>
    </div>
  )
}

/** Two players side by side: where they agree, where they part, who ran over more. */
export function CompareView({ lang, people, activeId, chapters, intro, tallies, foot = false, onNewGame }: CompareViewProps) {
  const ordered = people
  const [firstId, setFirstId] = useState(() => activeId ?? ordered[0]?.id ?? '')
  const [secondId, setSecondId] = useState(() => ordered.find((player) => player.id !== firstId)?.id ?? '')
  const [onlyDifferent, setOnlyDifferent] = useState(false)
  const ids = useId()
  // Numbers run straight through the set's chapters.
  const numbers = useMemo(() => new Map(chapters.flatMap((chapter) => chapter.dilemmas).map((dilemma, index) => [dilemma.id, index + 1])), [chapters])

  // Someone picked may since have been deleted: fall back to whoever is left.
  const first = ordered.find((player) => player.id === firstId) ?? ordered[0]
  const second = ordered.find((player) => player.id === secondId && player.id !== first?.id) ?? ordered.find((player) => player.id !== first?.id)
  // Picking the other side's player swaps the two, so nobody is compared with themselves.
  const pickFirst = (id: string): void => {
    if (id === second?.id && first) setSecondId(first.id)
    setFirstId(id)
  }
  const pickSecond = (id: string): void => {
    if (id === first?.id && second) setFirstId(second.id)
    setSecondId(id)
  }

  const heading = (
    <header className="atp-view-heading">
      <h2 className="atp-view-title">
        <PixelText text={UI.compareTitle[lang]} family={ROUNDED_FONT} weight={800} artSize={16} fill={['#fff8e8', '#f7e7c6']} shadow="#060f22" align="left" />
      </h2>
      <p className="atp-view-intro">{intro}</p>
    </header>
  )

  if (!first || !second) {
    return (
      <div className="atp-list-view">
        {heading}
        <div className="atp-vs-empty">
          <p>{UI.needTwo[lang]}</p>
          <button type="button" className="atp-chip" onClick={onNewGame}>
            {UI.newGame[lang]}
            <PixelArrow />
          </button>
        </div>
      </div>
    )
  }

  const answerOf = (person: Comparable, dilemma: AnyDilemma) => person.answers[dilemma.id as TrolleyVoteId]
  const result = compareAnswers(first.answers, second.answers, tallies, chapters)
  const rows = onlyDifferent ? result.shared.filter((dilemma) => answerOf(first, dilemma) !== answerOf(second, dilemma)) : result.shared

  const picker = (label: string, value: string, onChange: (id: string) => void, id: string) => (
    <label className="atp-field atp-vs-pick" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {ordered.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="atp-list-view">
      {heading}
      <div className="atp-vs-pickers">
        {picker(UI.playerOne[lang], first.id, pickFirst, `${ids}-first`)}
        <span className="atp-vs-mark" aria-hidden="true">
          VS
        </span>
        {picker(UI.playerTwo[lang], second.id, pickSecond, `${ids}-second`)}
      </div>

      <section className="atp-vs-board" aria-label={`${first.name} VS ${second.name}`}>
        <Totals lang={lang} player={first} totals={result.first} foot={foot} />
        <div className="atp-vs-score" aria-live="polite">
          {result.agreement === null ? (
            <p className="atp-vs-verdict">{UI.noShared[lang]}</p>
          ) : (
            <>
              <p className="atp-vs-percent">{agreementLine(lang, result.agreement)}</p>
              <p className="atp-vs-shared">{(foot ? FOOT_UI.sharedLine : sharedLine)(lang, result.same, result.shared.length)}</p>
              {result.verdict && <p className="atp-vs-verdict">{VERDICTS[result.verdict][lang]}</p>}
            </>
          )}
          <p className="atp-vs-lives">{(foot ? FOOT_UI.victimsLine : livesLine)(lang, { name: first.name, kills: result.first.kills }, { name: second.name, kills: result.second.kills })}</p>
        </div>
        <Totals lang={lang} player={second} totals={result.second} foot={foot} />
      </section>

      {result.shared.length > 0 && (
        <>
          <label className="atp-vs-filter">
            <input type="checkbox" checked={onlyDifferent} onChange={(event) => setOnlyDifferent(event.target.checked)} />
            {UI.onlyDifferent[lang]}
          </label>
          <ol className="atp-vs-list">
            {rows.map((dilemma) => {
              const a = answerOf(first, dilemma) ?? 'stay'
              const b = answerOf(second, dilemma) ?? 'stay'
              const differ = a !== b
              return (
                <li key={dilemma.id} className={`atp-vs-row ${differ ? 'is-differ' : ''}`}>
                  <span className="atp-card-number" aria-hidden="true">
                    {(numbers.get(dilemma.id) ?? 0).toString().padStart(2, '0')}
                  </span>
                  <p className="atp-vs-title">{dilemma.title[lang]}</p>
                  <p className={`atp-badge ${a === 'pull' ? 'is-pull' : 'is-stay'}`}>
                    {first.name}: {choiceName(lang, dilemma, a)}
                  </p>
                  <p className={`atp-badge ${b === 'pull' ? 'is-pull' : 'is-stay'}`}>
                    {second.name}: {choiceName(lang, dilemma, b)}
                  </p>
                  <p className={`atp-vs-tag ${differ ? 'is-differ' : ''}`}>{differ ? UI.differ[lang] : UI.agreed[lang]}</p>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}
