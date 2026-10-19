import { useId, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { COLOR_NAMES, continueAs, deleteQuestion, playerStats, UI } from '../content/strings'
import type { Lang } from '../content/types'
import { byRecent, cleanName, MAX_NAME, MAX_PLAYERS, nameTaken, nextColor, PLAYER_COLORS, type Player, type Players } from '../state/players'
import { killCount } from '../state/run'
import { setDilemmas } from '../state/sets'
import { CloseIcon, PixelArrow } from './pixel'

type StartScreenProps = {
  readonly lang: Lang
  readonly players: Players
  /** Whether there is a game to go back to (the screen was opened from inside one). */
  readonly canClose: boolean
  readonly onPick: (id: string) => void
  readonly onCreate: (name: string, color: string) => void
  readonly onDelete: (id: string) => void
  readonly onCompare: () => void
  readonly onClose: () => void
}

const ABSURD = setDilemmas('absurd')
const FOOT = setDilemmas('foot')

/** How far a player is in both sets, and what it has cost. */
function stats(lang: Lang, player: Player): string {
  const { answers } = player.progress
  const played = (dilemmas: typeof ABSURD) => dilemmas.filter((dilemma) => dilemma.id in answers).length
  const kills = killCount(answers, ABSURD) + killCount(answers, FOOT)
  return playerStats(lang, [played(ABSURD), ABSURD.length], [played(FOOT), FOOT.length], kills)
}

/** A free "Player 3"-style name to suggest for the next new game. */
function suggestedName(players: Players, base: string): string {
  for (let n = players.list.length + 1; ; n++) {
    const name = `${base} ${n}`
    if (!nameTaken(players, name)) return name
  }
}

/** The new game card's mark: a pixel plus in an empty avatar's place. */
function PlusIcon() {
  return (
    <span className="atp-new-plus" aria-hidden="true">
      <svg viewBox="0 0 7 7" shapeRendering="crispEdges">
        <path d="M3 0h1v3h3v1H4v3H3V4H0V3h3z" fill="currentColor" />
      </svg>
    </span>
  )
}

export function Avatar({ player, lang }: { readonly player: Pick<Player, 'name' | 'color'>; readonly lang: Lang }) {
  return (
    <span className="atp-avatar" aria-hidden="true" style={{ '--player': player.color } as CSSProperties}>
      {player.name.charAt(0).toLocaleUpperCase(lang)}
    </span>
  )
}

/**
 * Before anything else: who's playing? Everyone on this device has their own
 * game; pick one to carry on, or start a new one under your own name. The
 * choice of problems comes next.
 */
export function StartScreen({ lang, players, canClose, onPick, onCreate, onDelete, onCompare, onClose }: StartScreenProps) {
  const ordered = byRecent(players)
  const full = players.list.length >= MAX_PLAYERS
  // The panel is as wide as its cards (the players and a new game), up to three across.
  const columns = Math.min(ordered.length + 1, 3)
  const ids = useId()
  const [creating, setCreating] = useState(players.list.length === 0)
  // Until the player types their own, the suggested name follows the site's language.
  const [typed, setTyped] = useState<string | null>(null)
  const name = typed ?? suggestedName(players, UI.defaultPlayer[lang])
  const [color, setColor] = useState(() => nextColor(players))
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  // Opening the form on request (not on page load) puts the cursor in the name.
  const focusName = useRef(false)
  const nameField = (element: HTMLInputElement | null): void => {
    if (!element || !focusName.current) return
    focusName.current = false
    element.focus()
    element.select()
  }

  const openForm = (): void => {
    setTyped(null)
    setColor(nextColor(players))
    setError('')
    focusName.current = true
    setCreating(true)
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const clean = cleanName(name)
    if (!clean) return setError(UI.nameMissing[lang])
    if (nameTaken(players, clean)) return setError(UI.nameTaken[lang])
    onCreate(clean, color)
  }

  return (
    <section className="atp-start" aria-label={UI.whoPlays[lang]} style={{ '--columns': columns } as CSSProperties}>
      <div className="atp-start-head">
        <p className="atp-start-label">
          {UI.playersTitle[lang]} · {players.list.length} / {MAX_PLAYERS}
        </p>
        {players.list.length >= 2 && (
          <button type="button" className="atp-chip" onClick={onCompare}>
            VS · {UI.compareCta[lang]}
          </button>
        )}
        {canClose && (
          <button type="button" className="atp-square-button" onClick={onClose} aria-label={UI.backToGame[lang]} title={UI.backToGame[lang]}>
            <CloseIcon />
          </button>
        )}
      </div>
      <ul className="atp-players">
        {ordered.map((player) => (
          <li key={player.id} className={`atp-player ${player.id === players.activeId ? 'is-last' : ''}`}>
            <Avatar player={player} lang={lang} />
            <div className="atp-player-text">
              <h3 className="atp-player-name">{player.name}</h3>
              <p className="atp-player-stats">
                {stats(lang, player)}
              </p>
            </div>
            {player.id === players.activeId && <p className="atp-player-tag">{UI.lastPlayed[lang]}</p>}
            {deleting === player.id ? (
              <div className="atp-player-confirm">
                <p>{deleteQuestion(lang, player.name)}</p>
                <div className="atp-form-actions">
                  <button
                    type="button"
                    className="atp-chip is-reset"
                    onClick={() => {
                      setDeleting(null)
                      onDelete(player.id)
                    }}
                  >
                    {UI.deletePlayer[lang]}
                  </button>
                  <button type="button" className="atp-chip" onClick={() => setDeleting(null)}>
                    {UI.cancel[lang]}
                  </button>
                </div>
              </div>
            ) : (
              <div className="atp-player-actions">
                <button type="button" className="atp-player-play" aria-label={continueAs(lang, player.name)} onClick={() => onPick(player.id)}>
                  {UI.continueGame[lang]}
                  <PixelArrow />
                </button>
                <button
                  type="button"
                  className="atp-square-button is-small is-danger"
                  aria-label={`${UI.deletePlayer[lang]}: ${player.name}`}
                  title={UI.deletePlayer[lang]}
                  onClick={() => setDeleting(player.id)}
                >
                  <CloseIcon />
                </button>
              </div>
            )}
          </li>
        ))}
        <li className="atp-player is-new">
          {creating ? (
            <form className="atp-new-player" aria-label={UI.newGame[lang]} onSubmit={submit} noValidate>
              <p className="atp-new-title">{UI.newGame[lang]}</p>
              <p className="atp-new-setup">{UI.newGameSetup[lang]}</p>
              <label className="atp-field">
                <span>{UI.yourName[lang]}</span>
                <input
                  ref={nameField}
                  value={name}
                  maxLength={MAX_NAME}
                  placeholder={UI.namePlaceholder[lang]}
                  autoComplete="off"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'atp-name-error' : undefined}
                  onChange={(event) => {
                    setTyped(event.target.value)
                    setError('')
                  }}
                />
              </label>
              <fieldset className="atp-swatches">
                <legend>{UI.yourColor[lang]}</legend>
                {PLAYER_COLORS.map((swatch, index) => (
                  <label key={swatch} className="atp-swatch" style={{ '--swatch': swatch } as CSSProperties}>
                    <input type="radio" name="atp-color" value={swatch} checked={color === swatch} onChange={() => setColor(swatch)} />
                    <span className="sr-only">{COLOR_NAMES[index]?.[lang]}</span>
                  </label>
                ))}
              </fieldset>
              {error && (
                <p id="atp-name-error" className="atp-form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="atp-form-actions">
                <button type="submit" className="atp-start-button">
                  {UI.startGame[lang]}
                  <PixelArrow />
                </button>
                {players.list.length > 0 && (
                  <button type="button" className="atp-chip" onClick={() => setCreating(false)}>
                    {UI.cancel[lang]}
                  </button>
                )}
              </div>
            </form>
          ) : (
            <button type="button" className="atp-new-button" disabled={full} onClick={openForm} aria-labelledby={`${ids}-new`} aria-describedby={`${ids}-note`}>
              <PlusIcon />
              <span id={`${ids}-new`} className="atp-new-label">
                {UI.newGame[lang]}
              </span>
              <span id={`${ids}-note`} className="atp-new-note">
                {full ? UI.playersFull[lang] : UI.newGameShort[lang]}
              </span>
            </button>
          )}
        </li>
      </ul>
    </section>
  )
}
