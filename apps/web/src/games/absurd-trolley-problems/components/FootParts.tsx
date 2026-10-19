import { useId, useState } from 'react'
import { FOOT_ANSWERS, FOOT_DILEMMAS, FOOT_SOURCE, footCaseTitle, OTHER_FOOT_CASES, type FootDilemmaId } from '../content/foot'
import { choiceName, FOOT_PROFILES, FOOT_UI, UI } from '../content/strings'
import type { AnyDilemma, Lang, TrolleyChoice } from '../content/types'
import { agreementWithFoot, footProfile, principleScores } from '../state/compare'
import type { Answers } from '../state/run'
import { PixelArrow, ROUNDED_FONT, SegmentMeter } from './pixel'
import { PixelText } from './PixelText'

/** Pieces of the game that only Philippa Foot's cases have. */

const footAnswer = (dilemma: AnyDilemma): TrolleyChoice | null => FOOT_ANSWERS[dilemma.id as FootDilemmaId] ?? null

type FootVerdictProps = {
  readonly lang: Lang
  readonly dilemma: AnyDilemma
  readonly answer: TrolleyChoice | null
  /** Says it is Foot's answer (on a card, away from the research box that names her). */
  readonly labelled?: boolean
}

/** What Foot herself would do, and whether you did the same. */
export function FootVerdict({ lang, dilemma, answer, labelled = false }: FootVerdictProps) {
  const foot = footAnswer(dilemma)
  const who = labelled && <span className="atp-verdict-who">Foot: </span>
  if (foot === null) {
    return (
      <p className="atp-verdict">
        {who}
        {FOOT_UI.open[lang]}
      </p>
    )
  }
  const agrees = answer === foot
  return (
    <p className="atp-verdict" data-agrees={String(agrees)}>
      {who}
      <span className={`atp-verdict-choice is-${foot}`}>{choiceName(lang, dilemma, foot)}</span>{' '}
      <span className="atp-verdict-match">
        <span aria-hidden="true">{agrees ? '✓ ' : '✗ '}</span>
        {agrees ? FOOT_UI.same[lang] : FOOT_UI.different[lang]}
      </span>
    </p>
  )
}

type CaseState = 'same' | 'differ' | 'open' | 'unplayed'

const MARKS: Readonly<Record<CaseState, string>> = { same: '✓', differ: '✗', open: '–', unplayed: '·' }

const DILEMMAS = new Map<string, AnyDilemma>(FOOT_DILEMMAS.map((dilemma) => [dilemma.id, dilemma]))

/** One of Foot's cases on the end card: its short name, your call, and hers where they differ. */
function CaseRow({ lang, id, yours, onOpen }: { readonly lang: Lang; readonly id: FootDilemmaId; readonly yours: TrolleyChoice | undefined; readonly onOpen: (id: FootDilemmaId) => void }) {
  const dilemma = DILEMMAS.get(id)
  if (!dilemma) return null
  const foot = FOOT_ANSWERS[id]
  const state: CaseState = !yours ? 'unplayed' : foot === null ? 'open' : yours === foot ? 'same' : 'differ'
  const title = (footCaseTitle(id) ?? dilemma.title)[lang]
  return (
    <li>
      <button type="button" className="atp-fs-case" data-state={state} onClick={() => onOpen(id)} title={FOOT_UI.openCaseLabel(lang, title)}>
        <span className="atp-fs-mark" aria-hidden="true">
          {MARKS[state]}
        </span>
        <span className="atp-fs-case-title">{title}</span>
        <span className="atp-fs-case-call">
          <span className={`atp-fs-chip ${yours ? `is-${yours}` : ''}`}>{yours ? choiceName(lang, dilemma, yours) : FOOT_UI.notPlayed[lang]}</span>
          {state === 'differ' && foot && (
            <span className="atp-fs-foot">
              Foot: <span>{choiceName(lang, dilemma, foot)}</span>
            </span>
          )}
          {(state === 'same' || state === 'differ') && <span className="sr-only">{state === 'same' ? FOOT_UI.same[lang] : FOOT_UI.different[lang]}</span>}
          {state === 'open' && <span className="sr-only">{FOOT_UI.open[lang]}</span>}
        </span>
      </button>
    </li>
  )
}

type FootSummaryProps = {
  readonly lang: Lang
  readonly answers: Answers
  readonly onReplay: () => void
  readonly onBrowse: () => void
  readonly onChangeSet: () => void
  /** Opens one case's result (from its row). */
  readonly onOpen: (id: FootDilemmaId) => void
}

/**
 * After the last case: where the player stands against the essay, their
 * calls grouped by the line Foot draws (harm against harm, aid against aid,
 * harm for the sake of aid…), and where to go from here.
 */
export function FootSummary({ lang, answers, onReplay, onBrowse, onChangeSet, onOpen }: FootSummaryProps) {
  const headingId = useId()
  const [copied, setCopied] = useState(false)
  const { same, total } = agreementWithFoot(answers)
  const profile = FOOT_PROFILES[footProfile(answers) ?? 'own']
  const groups = principleScores(answers)

  const share = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(FOOT_UI.shareText(lang, same, total, profile.title[lang], `${window.location.origin}${window.location.pathname}`))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="atp-summary atp-foot-summary" aria-label={FOOT_UI.doneTitle[lang]}>
      <div className="atp-fs-head">
        <div className="atp-fs-profile">
          <p className="atp-summary-eyebrow">PHILIPPA FOOT · 1967 · {FOOT_UI.profileLabel[lang].toLocaleUpperCase(lang)}</p>
          <h3 className="atp-summary-title">
            <PixelText text={profile.title[lang]} family={ROUNDED_FONT} weight={800} artSize={16} fill={['#fff8e8', '#f7e7c6']} shadow="#060f22" align="left" />
          </h3>
          <p className="atp-summary-text">{profile.text[lang]}</p>
        </div>
        <div className="atp-fs-score">
          <p className="atp-fs-score-value" aria-hidden="true">
            {same}
            <span>/{total}</span>
          </p>
          <SegmentMeter value={total > 0 ? same / total : null} label={FOOT_UI.agreement(lang, same, total)} />
          <p className="atp-fs-score-label" aria-hidden="true">
            {FOOT_UI.sameAsFoot[lang]}
          </p>
        </div>
      </div>

      <div className="atp-summary-actions">
        <button type="button" className="atp-next is-primary" onClick={onReplay}>
          {FOOT_UI.playAgain[lang]}
          <PixelArrow />
        </button>
        <button type="button" className="atp-next" onClick={onBrowse}>
          {FOOT_UI.casesTitle[lang]}
        </button>
        <button type="button" className="atp-next" onClick={onChangeSet}>
          {FOOT_UI.changeSetLabel[lang]}
        </button>
        <button type="button" className="atp-next" onClick={() => void share()} aria-live="polite">
          {copied ? UI.copied[lang] : UI.share[lang]}
        </button>
      </div>

      <h4 id={headingId} className="atp-fs-heading">
        {FOOT_UI.principlesTitle[lang]}
      </h4>
      <ul className="atp-fs-groups" aria-labelledby={headingId}>
        {groups.map(({ principle, answered, same: matched }) => (
          <li key={principle.id} className="atp-fs-group" data-principle={principle.id}>
            <div className="atp-fs-group-head">
              <h5 className="atp-fs-group-title">{principle.title[lang]}</h5>
              {principle.id !== 'open' && answered > 0 && (
                <span className="atp-fs-group-score" data-all={String(matched === answered)}>
                  {matched}/{answered}
                </span>
              )}
            </div>
            <p className="atp-fs-rule">
              <span>Foot:</span> {principle.rule[lang]}
            </p>
            <ul className="atp-fs-cases">
              {principle.cases.map((id) => (
                <CaseRow key={id} lang={lang} id={id} yours={answers[id]} onOpen={onOpen} />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The cases in the essay that are not choices, with where Foot comes down on each. */
export function FootOtherCases({ lang }: { readonly lang: Lang }) {
  const titleId = useId()
  return (
    <section className="atp-foot-cases" aria-labelledby={titleId}>
      <h3 id={titleId} className="atp-foot-cases-title">
        {FOOT_UI.otherTitle[lang]}
      </h3>
      <p className="atp-view-intro">
        {FOOT_UI.otherIntro[lang]}{' '}
        <a className="atp-fact-source" href={FOOT_SOURCE.url} target="_blank" rel="noopener noreferrer">
          {FOOT_UI.readEssay[lang]}
        </a>
      </p>
      <ul className="atp-case-list">
        {OTHER_FOOT_CASES.map((footCase) => (
          <li key={footCase.id} className="atp-case">
            <h4 className="atp-case-title">{footCase.title[lang]}</h4>
            <p className="atp-case-summary">{footCase.summary[lang]}</p>
            <p className="atp-case-verdict">
              <span>Foot:</span> {footCase.verdict[lang]}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
