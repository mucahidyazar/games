import { useState } from 'react'
import { ARCHETYPES, count, percent, UI } from '../content/strings'
import type { Chapter, Lang } from '../content/types'
import type { ChapterSummary } from '../state/run'
import { PixelArrow, ROUNDED_FONT } from './pixel'
import { PixelText } from './PixelText'

type SummaryPanelProps = {
  readonly lang: Lang
  readonly chapter: Chapter
  readonly summary: ChapterSummary
  readonly hasNextChapter: boolean
  readonly onNextChapter: () => void
  readonly onReplay: () => void
  readonly onBackToStart: () => void
  readonly onBrowse: () => void
}

/** The end of a chapter: a moral profile, the damage done and where to go next. */
export function SummaryPanel({ lang, chapter, summary, hasNextChapter, onNextChapter, onReplay, onBackToStart, onBrowse }: SummaryPanelProps) {
  const [copied, setCopied] = useState(false)
  const archetype = ARCHETYPES[summary.archetype]
  const stats = [
    { label: UI.livesLost[lang], value: count(lang, summary.lives) },
    { label: UI.thingsLost[lang], value: count(lang, summary.things) },
    { label: UI.pulls[lang], value: `${summary.pulls} / ${summary.answered}` },
    { label: UI.agreement[lang], value: summary.agreement === null ? '—' : percent(lang, summary.agreement * 100) },
  ]

  const share = async (): Promise<void> => {
    const text =
      lang === 'tr'
        ? `Absürt Tramvay Problemleri · ${chapter.title.tr}: “${archetype.title.tr}”. ${summary.lives} can, ${summary.pulls} kez kol çektim. ${window.location.origin}${window.location.pathname}`
        : `Absurd Trolley Problems · ${chapter.title.en}: “${archetype.title.en}”. ${summary.lives} lives lost, ${summary.pulls} lever pulls. ${window.location.origin}${window.location.pathname}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="atp-summary" aria-labelledby="atp-summary-title">
      <p className="atp-summary-eyebrow">
        {chapter.title[lang]} · {UI.summaryTitle[lang]}
      </p>
      <h3 id="atp-summary-title" className="atp-summary-title">
        <PixelText text={archetype.title[lang]} family={ROUNDED_FONT} weight={800} artSize={16} fill={['#fff8e8', '#f7e7c6']} shadow="#060f22" />
      </h3>
      <p className="atp-summary-text">{archetype.text[lang]}</p>
      <dl className="atp-summary-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="atp-summary-stat">
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
      <div className="atp-summary-actions">
        {hasNextChapter ? (
          <button type="button" className="atp-next is-primary" onClick={onNextChapter}>
            {UI.nextChapter[lang]}
            <PixelArrow />
          </button>
        ) : (
          <button type="button" className="atp-next is-primary" onClick={onBackToStart}>
            {UI.backToStart[lang]}
            <PixelArrow />
          </button>
        )}
        <button type="button" className="atp-next" onClick={onReplay}>
          {UI.playAgain[lang]}
        </button>
        <button type="button" className="atp-next" onClick={onBrowse}>
          {UI.browse[lang]}
        </button>
        <button type="button" className="atp-next" onClick={() => void share()} aria-live="polite">
          {copied ? UI.copied[lang] : UI.share[lang]}
        </button>
      </div>
    </section>
  )
}
