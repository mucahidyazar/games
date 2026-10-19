import { useId } from 'react'
import { MODES, UI } from '../content/strings'
import type { Lang } from '../content/types'
import type { Answers } from '../state/run'
import { setDilemmas, type SetId } from '../state/sets'
import { CloseIcon, PixelArrow } from './pixel'
import { Avatar } from './StartScreen'

/** Philippa Foot's tile: the fork her driver faces, in smooth lines. */
function FootArt() {
  return (
    <svg className="atp-mode-art is-foot" viewBox="0 0 200 72" aria-hidden="true">
      <path d="M0 30H76C104 30 112 58 140 58H200" fill="none" stroke="#7fe3b8" strokeOpacity="0.8" strokeWidth="3" strokeLinecap="round" />
      <path d="M0 30H200" fill="none" stroke="#f6ead0" strokeWidth="3" strokeLinecap="round" />
      {[150, 162, 174, 186].map((x) => (
        <circle key={x} cx={x} cy={24} r={4} fill="#f6ead0" />
      ))}
      <circle cx={170} cy={52} r={4} fill="#7fe3b8" />
      <g transform="translate(20 12)">
        <rect width="44" height="16" rx="6" fill="#ffd36b" />
        <rect x="6" y="4" width="9" height="6" rx="2" fill="#13254a" />
        <rect x="18" y="4" width="9" height="6" rx="2" fill="#13254a" />
        <rect x="30" y="4" width="9" height="6" rx="2" fill="#13254a" />
        <circle cx="46" cy="9" r="2.4" fill="#fff8e8" />
      </g>
    </svg>
  )
}

/** The absurd tile: a pixel cat on the tracks, the way the 3D game draws it. */
function AbsurdArt() {
  return (
    <svg className="atp-mode-art is-absurd" viewBox="0 0 50 18" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="0" y="15" width="50" height="1" fill="#6c7f9e" />
      <g fill="#3d4a63">
        {[2, 8, 14, 20, 26, 32, 38, 44].map((x) => (
          <rect key={x} x={x} y="16" width="3" height="1" />
        ))}
      </g>
      <g transform="translate(4 6)">
        <rect width="14" height="8" fill="#ffd36b" />
        <rect x="2" y="2" width="3" height="2" fill="#13254a" />
        <rect x="6" y="2" width="3" height="2" fill="#13254a" />
        <rect x="10" y="2" width="3" height="2" fill="#13254a" />
        <rect x="1" y="8" width="2" height="1" fill="#2a2b33" />
        <rect x="11" y="8" width="2" height="1" fill="#2a2b33" />
      </g>
      <g transform="translate(34 8)">
        <rect x="0" y="0" width="1" height="2" fill="#f0973f" />
        <rect x="4" y="0" width="1" height="2" fill="#f0973f" />
        <rect x="0" y="1" width="5" height="4" fill="#f0973f" />
        <rect x="1" y="2" width="1" height="1" fill="#1d1a1f" />
        <rect x="3" y="2" width="1" height="1" fill="#1d1a1f" />
        <rect x="1" y="5" width="7" height="2" fill="#f0973f" />
        <rect x="8" y="3" width="1" height="3" fill="#f0973f" />
        <rect x="2" y="5" width="2" height="2" fill="#f7f1e6" />
      </g>
      <g fill="#ff8fa3">
        <rect x="40" y="2" width="1" height="1" />
        <rect x="42" y="2" width="1" height="1" />
        <rect x="40" y="3" width="3" height="1" />
        <rect x="41" y="4" width="1" height="1" />
      </g>
    </svg>
  )
}

type ModePickerProps = {
  readonly lang: Lang
  /** Who is about to play, and what they have played so far. */
  readonly player: { readonly name: string; readonly color: string; readonly answers: Answers }
  /** Whether there is a game to go back to. */
  readonly canClose: boolean
  readonly onPick: (set: SetId) => void
  readonly onBack: () => void
  readonly onClose: () => void
}

/** Once the player is known: the trolley problem as Philippa Foot wrote it, or the absurd game. */
export function ModePicker({ lang, player, canClose, onPick, onBack, onClose }: ModePickerProps) {
  const id = useId()
  const played = (set: SetId): readonly [number, number] => {
    const dilemmas = setDilemmas(set)
    return [dilemmas.filter((dilemma) => dilemma.id in player.answers).length, dilemmas.length]
  }
  const tiles = [
    { set: 'foot', art: <FootArt />, copy: MODES.foot, meta: MODES.foot.meta(lang, ...played('foot')) },
    { set: 'absurd', art: <AbsurdArt />, copy: MODES.absurd, meta: MODES.absurd.meta(lang, ...played('absurd')) },
  ] as const

  return (
    <section className="atp-start atp-modes" aria-label={UI.whichProblems[lang]}>
      <div className="atp-start-head">
        <button type="button" className="atp-chip atp-start-back" onClick={onBack}>
          <PixelArrow />
          {UI.playersTitle[lang]}
        </button>
        <p className="atp-start-label atp-start-who">
          <Avatar player={player} lang={lang} />
          <span>{player.name}</span>
        </p>
        {canClose && (
          <button type="button" className="atp-square-button" onClick={onClose} aria-label={UI.backToGame[lang]} title={UI.backToGame[lang]}>
            <CloseIcon />
          </button>
        )}
      </div>
      <ul className="atp-mode-list">
        {tiles.map(({ set, art, copy, meta }) => (
          <li key={set}>
            <button type="button" className={`atp-mode is-${set}`} aria-labelledby={`${id}-${set}-name`} aria-describedby={`${id}-${set}-text`} onClick={() => onPick(set)}>
              {art}
              <span className="atp-mode-kicker">{copy.kicker[lang]}</span>
              <span className="atp-mode-name" id={`${id}-${set}-name`}>
                {copy.name[lang]}
              </span>
              <span className="atp-mode-text" id={`${id}-${set}-text`}>
                {copy.text[lang]}
              </span>
              <span className="atp-mode-foot">
                <span className="atp-mode-meta">{meta}</span>
                <span className="atp-mode-go" aria-hidden="true">
                  {UI.begin[lang]}
                  <PixelArrow />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
