import { count, FOOT_UI, percent, UI } from '../content/strings'
import type { AnyDilemma, Lang, TrolleyVoteId } from '../content/types'
import { pullShare, totalVotes, type Tallies } from '../state/run'
import { ROUNDED_FONT } from './pixel'
import { PixelText } from './PixelText'

type CommunityViewProps = {
  readonly lang: Lang
  /** The set on show, in order. */
  readonly dilemmas: readonly AnyDilemma[]
  readonly intro: string
  readonly tallies: Tallies
  readonly status: 'loading' | 'ready' | 'error'
  /** Philippa Foot's cases, where the share is of the first option rather than of lever pulls. */
  readonly foot?: boolean
}

interface Row {
  readonly dilemma: AnyDilemma
  readonly number: number
  readonly share: number | null
  readonly votes: number
}

/** The community's split on every dilemma of a set, and the extremes. */
export function CommunityView({ lang, dilemmas, intro, tallies, status, foot = false }: CommunityViewProps) {
  const rows: Row[] = dilemmas.map((dilemma, index) => ({
    dilemma,
    number: index + 1,
    share: pullShare(tallies[dilemma.id as TrolleyVoteId]),
    votes: totalVotes(tallies[dilemma.id as TrolleyVoteId]),
  }))
  const voted = rows.filter((row): row is Row & { share: number } => row.share !== null)
  const total = rows.reduce((sum, row) => sum + row.votes, 0)
  // Only a vote that actually split can be the most divisive.
  const divisive = [...voted].filter((row) => row.share > 0 && row.share < 1).sort((a, b) => Math.abs(a.share - 0.5) - Math.abs(b.share - 0.5))[0]
  const most = [...voted].sort((a, b) => b.share - a.share)[0]
  const least = [...voted].sort((a, b) => a.share - b.share)[0]
  const highlights = [
    { label: UI.mostDivisive[lang], row: divisive, empty: voted.length > 0 ? UI.noSplitYet[lang] : UI.noVotesYet[lang] },
    { label: foot ? FOOT_UI.mostFirst[lang] : UI.mostPulled[lang], row: most, empty: UI.noVotesYet[lang] },
    { label: foot ? FOOT_UI.leastFirst[lang] : UI.leastPulled[lang], row: least, empty: UI.noVotesYet[lang] },
  ]

  return (
    <div className="atp-list-view">
      <header className="atp-view-heading">
        <h2 className="atp-view-title">
          <PixelText text={UI.communityTitle[lang]} family={ROUNDED_FONT} weight={800} artSize={16} fill={['#fff8e8', '#f7e7c6']} shadow="#060f22" align="left" />
        </h2>
        <p className="atp-view-intro">{intro}</p>
      </header>

      {status === 'error' && <p className="atp-view-note">{UI.noCommunity[lang]}</p>}
      {status === 'loading' && <p className="atp-view-note">{UI.waitingVote[lang]}</p>}

      {status === 'ready' && (
        <>
          <dl className="atp-highlights">
            <div className="atp-highlight">
              <dt>{UI.totalVotes[lang]}</dt>
              <dd className="atp-highlight-value">{count(lang, total)}</dd>
            </div>
            {highlights.map(({ label, row, empty }) => (
              <div key={label} className="atp-highlight">
                <dt>{label}</dt>
                <dd>
                  {row ? (
                    <>
                      <span className="atp-highlight-value">{percent(lang, row.share * 100)}</span>
                      <span className="atp-highlight-title">{row.dilemma.title[lang]}</span>
                    </>
                  ) : (
                    <span className="atp-highlight-title">{empty}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <ol className="atp-bars">
            {rows.map((row) => {
              const pulled = row.dilemma.verbs?.pulled[lang] ?? UI.pulledShort[lang]
              return (
                <li key={row.dilemma.id} className="atp-bar-row">
                  <span className="atp-bar-number" aria-hidden="true">
                    {row.number.toString().padStart(2, '0')}
                  </span>
                  <span className="atp-bar-title">{row.dilemma.title[lang]}</span>
                  {row.share === null ? (
                    <span className="atp-bar-empty">{UI.noVotesYet[lang]}</span>
                  ) : (
                    <span className="atp-bar" role="img" aria-label={`${percent(lang, row.share * 100)} ${pulled}, ${count(lang, row.votes)} ${row.votes === 1 ? UI.vote[lang] : UI.votes[lang]}`}>
                      <span className="atp-bar-fill" style={{ width: `${row.share * 100}%` }} />
                      <span className="atp-bar-label">{percent(lang, row.share * 100)}</span>
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}
