import '@fontsource-variable/rubik/wght.css'
import '@fontsource/silkscreen/400.css'
import '@fontsource/silkscreen/700.css'
import '../trolley.css'
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '@/app/lang'
import { getBrowserStore } from '@/games/trap-the-orb/storage/keyValueStore'
import { usePrefersReducedMotion } from '@/lib/motion'
import { useCastVote, useTallies } from '../api/votes'
import { createTrolleyAudio } from '../audio/trolleyAudio'
import { CHAPTERS } from '../content/dilemmas'
import { FOOT_DILEMMAS } from '../content/foot'
import { FOOT_UI, MODES, UI } from '../content/strings'
import type { AnyChapter, AnyDilemma, Chapter, TrolleyChoice, TrolleyVoteId } from '../content/types'
import { MotionStage } from '../motion/MotionStage'
import type { SceneEvent, SceneEventDetail } from '../scene/TrolleyScene'
import { agreementWithFoot, FOOT_PERSON, type Comparable } from '../state/compare'
import { activePlayer, addPlayer, byRecent, choosePlayer, loadPlayers, removePlayer, savePlayers, updateActive, type Players } from '../state/players'
import { withoutAnswer, withoutChapter, withoutFoot, type Progress } from '../state/progress'
import { killCount, lossesFor, summarize, trackAFor, withOwnVote, type Tallies } from '../state/run'
import { locate, moveTo, positionIn, SET_CHAPTERS, setDilemmas, type Position, type SetId } from '../state/sets'
import { CommunityView } from './CommunityView'
import { CompareView } from './CompareView'
import { DilemmasView } from './DilemmasView'
import { FootOtherCases, FootSummary, FootVerdict } from './FootParts'
import { ModePicker } from './ModePicker'
import { PlayView, type Community, type Overlay, type Phase } from './PlayView'
import { playSceneSound } from './sceneSounds'
import type { StageHandle } from './Stage'
import { StartScreen } from './StartScreen'
import { SummaryPanel } from './SummaryPanel'
import { GameTabs, TrolleyHeader, type TabId } from './TrolleyHeader'

type TrolleyGameProps = {
  /** Where the game draws its own site header (App's header slot), while it is on screen. */
  readonly headerSlot: HTMLElement | null
  /** False while another page of the site is showing. */
  readonly isActive: boolean
  readonly isDialogOpen: boolean
  /** The site-wide sound switch in the header. */
  readonly soundEnabled: boolean
  readonly onToggleSound: () => void
}

const NO_TALLIES: Tallies = {}
const NO_PROGRESS = { chapter: 0, index: 0, answers: {}, foot: 0, voterId: '' }
const SETS: readonly SetId[] = ['absurd', 'foot']
const LAST_FOOT_CASE = FOOT_DILEMMAS[FOOT_DILEMMAS.length - 1] ?? null

/**
 * Absurd Trolley Problems: the whole game inside the site's page. Whoever
 * plays picks themselves first, then the problems: the absurd dilemmas, in
 * 3D pixels, or Philippa Foot's original cases, in motion. Every tab follows
 * the problems chosen.
 */
export function TrolleyGame({ headerSlot, isActive, isDialogOpen, soundEnabled, onToggleSound }: TrolleyGameProps) {
  const store = useMemo(() => getBrowserStore(), [])
  const lang = useLang()
  // Everyone who plays on this device, each with their own game in both sets.
  const [players, setPlayers] = useState<Players>(() => loadPlayers(store, UI.defaultPlayer[lang]))
  // The game opens on who's playing, then which problems; the chips by the kill count bring either back.
  const [startOpen, setStartOpen] = useState(true)
  const [startStep, setStartStep] = useState<'players' | 'sets'>('players')
  // Until a game has been entered, the start screens have nothing to close back to.
  const [entered, setEntered] = useState(false)
  const [set, setSet] = useState<SetId>('absurd')
  // Where to start a first player who asked to play something before anyone had a game.
  const [pending, setPending] = useState<{ readonly set: SetId; readonly position: Position } | null>(null)
  const [tab, setTab] = useState<TabId>('play')
  const [running, setRunning] = useState(false)
  /** Lives the tram (or whatever else) has taken so far in the run that is playing. */
  const [impacts, setImpacts] = useState(0)
  const stageRef = useRef<StageHandle>(null)
  const reducedMotion = usePrefersReducedMotion()
  const baseId = useId()
  const talliesQuery = useTallies()
  const vote = useCastVote()

  useEffect(() => {
    savePlayers(store, players)
  }, [store, players])

  const player = activePlayer(players)
  // The game that is on, as progress; changes to it are changes to that player's game.
  const progress: Progress = useMemo(() => ({ ...(player?.progress ?? NO_PROGRESS), music: players.music }), [player, players.music])
  const setProgress = (update: (current: Progress) => Progress): void => setPlayers((current) => updateActive(current, update))

  // Made once; it touches no audio hardware until a gesture unlocks it.
  const [audio] = useState(() => createTrolleyAudio(soundEnabled, progress.music))
  useEffect(() => audio.setEnabled(soundEnabled && isActive), [audio, soundEnabled, isActive])
  useEffect(() => audio.setMusic(progress.music), [audio, progress.music])
  useEffect(() => () => audio.dispose(), [audio])

  const isFoot = set === 'foot'
  const chapters = SET_CHAPTERS[set]
  const position = positionIn(progress, set)
  const chapter = (chapters[position.chapter] ?? chapters[0]) as AnyChapter
  const atEnd = position.index >= chapter.dilemmas.length
  const dilemma = atEnd ? null : (chapter.dilemmas[position.index] ?? null)
  const answerOf = (shown: AnyDilemma): TrolleyChoice | null => progress.answers[shown.id as TrolleyVoteId] ?? null
  const answer = dilemma ? answerOf(dilemma) : null
  const phase: Phase = running ? 'running' : answer ? 'result' : 'deciding'
  const trackA = useMemo(() => (dilemma ? trackAFor(dilemma, progress.answers) : []), [dilemma, progress.answers])
  const dilemmas = useMemo(() => setDilemmas(set), [set])
  const tallies: Tallies = talliesQuery.data?.tallies ?? NO_TALLIES
  const totalKills = useMemo(() => killCount(progress.answers, dilemmas), [progress.answers, dilemmas])
  // During a run the count climbs with each hit instead of jumping when the choice is made.
  const runLives = running && dilemma && answer ? lossesFor(dilemma, answer, trackA).lives : 0
  const kills = totalKills - runLives + Math.min(impacts, runLives)
  const status = talliesQuery.isPending ? 'loading' : talliesQuery.isError && !talliesQuery.data ? 'error' : 'ready'

  const community: Community = useMemo(() => {
    if (!dilemma || !answer) return { tally: null, status }
    const id = dilemma.id as TrolleyVoteId
    const cached = tallies[id]
    const ownVoteInFlight = vote.variables?.dilemmaId === id && (vote.isPending || vote.isError)
    return { tally: ownVoteInFlight ? withOwnVote(cached, answer) : (cached ?? null), status }
  }, [dilemma, answer, tallies, status, vote.variables, vote.isPending, vote.isError])

  const choose = (choice: TrolleyChoice): void => {
    if (!player || startOpen || !dilemma || answer || running || tab !== 'play') return
    const id = dilemma.id as TrolleyVoteId
    audio.unlock()
    audio.play('click')
    setImpacts(0)
    setRunning(true)
    setProgress((current) => ({ ...current, answers: { ...current.answers, [id]: choice } }))
    vote.mutate({ dilemmaId: id, choice, voterId: progress.voterId })
    audio.duck(true)
    void (stageRef.current?.play(choice) ?? Promise.resolve()).then(() => {
      setRunning(false)
      audio.duck(false)
      audio.play('reveal')
    })
  }

  const next = (): void => {
    if (phase !== 'result') return
    const last = position.index >= chapter.dilemmas.length - 1
    audio.play(last ? 'chapter' : 'whoosh')
    setProgress((current) => moveTo(current, set, { chapter: position.chapter, index: position.index + 1 }))
  }

  /** Into a game of `to`: the start screens close and the play tab shows. */
  const enter = (to: SetId): void => {
    setSet(to)
    setStartOpen(false)
    setEntered(true)
    setTab('play')
  }

  const openPlayers = (): void => {
    if (running) return
    audio.play('click')
    setStartOpen(true)
    setStartStep('players')
    setTab('play')
  }

  const openSets = (): void => {
    if (running) return
    audio.play('click')
    setStartOpen(true)
    setStartStep('sets')
    setTab('play')
  }

  /** Plays from somewhere in a set; asked before anyone had a game, the first player starts there. */
  const playFrom = (to: SetId, at: Position): void => {
    if (running) return
    if (!player) {
      setPending({ set: to, position: at })
      openPlayers()
      return
    }
    audio.play('click')
    setProgress((current) => moveTo(current, to, at))
    enter(to)
  }

  /** Starts a chapter (Foot's cases are one) from its first dilemma, its old answers forgotten. */
  const startChapter = (index: number): void => {
    if (running) return
    if (!player) {
      setPending({ set, position: { chapter: index, index: 0 } })
      openPlayers()
      return
    }
    audio.play('whoosh')
    setProgress((current) => moveTo(set === 'foot' ? withoutFoot(current) : withoutChapter(current, index), set, { chapter: index, index: 0 }))
    enter(set)
  }

  /** Once the player is known: the problems come next, unless they already asked for a dilemma. */
  const afterPlayer = (): void => {
    if (!pending) {
      setStartStep('sets')
      return
    }
    setPlayers((current) => updateActive(current, (chosen) => moveTo(chosen, pending.set, pending.position)))
    setPending(null)
    enter(pending.set)
  }

  const pickPlayer = (id: string): void => {
    audio.unlock()
    audio.play('click')
    setPlayers((current) => choosePlayer(current, id))
    afterPlayer()
  }

  const newPlayer = (name: string, color: string): void => {
    audio.unlock()
    audio.play('whoosh')
    setPlayers((current) => addPlayer(current, name, color))
    afterPlayer()
  }

  const pickSet = (to: SetId): void => {
    audio.unlock()
    audio.play(to === 'foot' ? 'whoosh' : 'click')
    enter(to)
  }

  const deletePlayer = (id: string): void => {
    audio.play('click')
    setPlayers((current) => removePlayer(current, id))
  }

  // The Dilemmas tab can take back a choice, or a whole chapter of them, to play again.
  const resetDilemma = (id: TrolleyVoteId): void => {
    if (running) return
    audio.play('click')
    setProgress((current) => withoutAnswer(current, id))
  }

  const resetChapter = (index: number): void => {
    if (running) return
    audio.play('whoosh')
    setProgress((current) => (set === 'foot' ? withoutFoot(current) : withoutChapter(current, index)))
  }

  const jumpTo = (id: TrolleyVoteId): void => {
    const found = locate(id)
    if (found) playFrom(found.set, found.position)
  }

  /** From the list tabs: the other set's dilemmas, votes and comparisons. */
  const switchSet = (to: SetId): void => {
    if (running || to === set) return
    audio.play('click')
    setSet(to)
  }

  const onSceneEvent = (event: SceneEvent, detail?: SceneEventDetail): void => {
    if (playSceneSound(audio, event, detail)) setImpacts((current) => current + 1)
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
    const key = event.key.toLowerCase()
    if (key === 'm') onToggleSound()
    else if (tab !== 'play' || startOpen) return
    else if (key === 'a') choose('pull')
    else if (key === 'd') choose('stay')
    else if ((key === 'enter' || key === 'arrowright') && !target?.closest('button, a, [role="tab"]')) next()
    else return
    event.preventDefault()
  })

  useEffect(() => {
    if (!isActive || isDialogOpen) return
    const listener = (event: KeyboardEvent): void => onKey(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [isActive, isDialogOpen])

  const toggleMusic = (): void => {
    audio.unlock()
    setProgress((current) => ({ ...current, music: !current.music }))
  }

  const panelId = (id: TabId): string => `${baseId}-panel-${id}`
  const tabId = (id: TabId): string => `${baseId}-tab-${id}`
  const counter = { current: Math.min(position.index + 1, chapter.dilemmas.length), total: chapter.dilemmas.length }
  // Behind Foot's end card, her last case stays on stage.
  const shown = dilemma ?? (isFoot && atEnd ? LAST_FOOT_CASE : null)

  const showPlayers = !player || (startOpen && startStep === 'players')
  let overlay: Overlay | undefined
  if (showPlayers) {
    overlay = {
      kind: 'start',
      title: UI.whoPlays[lang],
      setup: UI.whoPlaysSetup[lang],
      content: (
        <StartScreen
          key={players.list.length}
          lang={lang}
          players={players}
          canClose={entered && player !== null}
          onPick={pickPlayer}
          onCreate={newPlayer}
          onDelete={deletePlayer}
          onCompare={() => {
            audio.play('click')
            setTab('compare')
          }}
          onClose={() => setStartOpen(false)}
        />
      ),
    }
  } else if (startOpen) {
    overlay = {
      kind: 'start',
      title: UI.whichProblems[lang],
      setup: UI.whichProblemsSetup[lang],
      content: (
        <ModePicker
          lang={lang}
          player={{ name: player.name, color: player.color, answers: player.progress.answers }}
          canClose={entered}
          onPick={pickSet}
          onBack={() => {
            audio.play('click')
            setStartStep('players')
          }}
          onClose={() => setStartOpen(false)}
        />
      ),
    }
  } else if (atEnd && isFoot) {
    const agreement = agreementWithFoot(progress.answers)
    overlay = {
      kind: 'summary',
      title: FOOT_UI.doneTitle[lang],
      setup: FOOT_UI.agreement(lang, agreement.same, agreement.total),
      content: <FootSummary lang={lang} answers={progress.answers} onReplay={() => startChapter(0)} onBrowse={() => setTab('dilemmas')} onChangeSet={openSets} onOpen={jumpTo} />,
    }
  } else if (atEnd) {
    const absurdChapter = chapter as Chapter
    overlay = {
      kind: 'summary',
      title: UI.chapterDone[lang],
      setup: UI.summaryTitle[lang],
      content: (
        <SummaryPanel
          lang={lang}
          chapter={absurdChapter}
          summary={summarize(absurdChapter, progress.answers, tallies)}
          hasNextChapter={position.chapter < CHAPTERS.length - 1}
          onNextChapter={() => startChapter(position.chapter + 1)}
          onReplay={() => startChapter(position.chapter)}
          onBackToStart={() => startChapter(0)}
          onBrowse={() => setTab('dilemmas')}
        />
      ),
    }
  }

  const people: readonly Comparable[] = [
    ...byRecent(players).map((each) => ({ id: each.id, name: each.name, color: each.color, answers: each.progress.answers })),
    ...(isFoot ? [FOOT_PERSON] : []),
  ]

  return (
    <section className="atp" aria-label={UI.gameName[lang]} lang={lang} onPointerDown={() => audio.unlock()} onKeyDown={() => audio.unlock()}>
      {headerSlot &&
        createPortal(
          <TrolleyHeader
            lang={lang}
            counter={counter}
            counterLabel={isFoot ? FOOT_UI.counter[lang] : undefined}
            music={progress.music}
            sound={soundEnabled}
            onMusic={toggleMusic}
            onSound={onToggleSound}
          >
            <GameTabs
              lang={lang}
              tab={tab}
              panelId={panelId}
              tabId={tabId}
              labels={isFoot ? { dilemmas: FOOT_UI.casesTab[lang] } : undefined}
              onTab={(id) => {
                audio.unlock()
                audio.play('click')
                setTab(id)
              }}
            />
          </TrolleyHeader>,
          headerSlot,
        )}

      <div role="tabpanel" id={panelId('play')} aria-labelledby={tabId('play')} hidden={tab !== 'play'}>
        <PlayView
          stageRef={stageRef}
          lang={lang}
          dilemma={shown}
          trackA={trackA}
          answer={shown ? answerOf(shown) : null}
          phase={phase}
          isLast={position.index === chapter.dilemmas.length - 1}
          community={community}
          kills={kills}
          reducedMotion={reducedMotion}
          onChoose={choose}
          onNext={next}
          onSceneEvent={onSceneEvent}
          overlay={overlay}
          player={player}
          onSwitchPlayer={openPlayers}
          setKey={`${player?.id ?? ''}:${set}`}
          stage={isFoot ? MotionStage : undefined}
          eyebrow={isFoot ? FOOT_UI.eyebrow(lang, counter.current, counter.total) : undefined}
          bookTitle={isFoot}
          verdict={isFoot && dilemma ? <FootVerdict lang={lang} dilemma={dilemma} answer={answer} /> : undefined}
          victims={isFoot}
          nextLabel={isFoot ? FOOT_UI.next[lang] : undefined}
          hint={isFoot ? FOOT_UI.keyHint[lang] : undefined}
          onChangeSet={openSets}
        />
      </div>

      {tab !== 'play' && (
        <div className="atp-set-switch" role="group" aria-label={UI.setsLabel[lang]}>
          {SETS.map((id) => (
            <button key={id} type="button" className="atp-chip" aria-pressed={set === id} disabled={running} onClick={() => switchSet(id)}>
              {MODES[id].name[lang]}
            </button>
          ))}
        </div>
      )}
      <div role="tabpanel" id={panelId('dilemmas')} aria-labelledby={tabId('dilemmas')} hidden={tab !== 'dilemmas'}>
        {tab === 'dilemmas' && (
          <DilemmasView
            lang={lang}
            chapters={chapters}
            title={isFoot ? FOOT_UI.casesTitle[lang] : UI.dilemmasTitle[lang]}
            intro={isFoot ? FOOT_UI.casesIntro[lang] : UI.dilemmasIntro[lang]}
            words={isFoot ? { resetChapter: FOOT_UI.resetCases[lang], playChapter: FOOT_UI.playCases[lang], play: FOOT_UI.playCase[lang] } : undefined}
            extra={isFoot ? (card) => <FootVerdict lang={lang} dilemma={card} answer={answerOf(card)} labelled /> : undefined}
            answers={progress.answers}
            tallies={tallies}
            player={player}
            onSwitchPlayer={openPlayers}
            busy={running}
            onPlay={jumpTo}
            onReset={resetDilemma}
            onResetChapter={resetChapter}
            onPlayChapter={startChapter}
          >
            {isFoot && <FootOtherCases lang={lang} />}
          </DilemmasView>
        )}
      </div>
      <div role="tabpanel" id={panelId('community')} aria-labelledby={tabId('community')} hidden={tab !== 'community'}>
        {tab === 'community' && (
          <CommunityView lang={lang} dilemmas={dilemmas} intro={isFoot ? FOOT_UI.communityIntro[lang] : UI.communityIntro[lang]} tallies={tallies} status={status} foot={isFoot} />
        )}
      </div>
      <div role="tabpanel" id={panelId('compare')} aria-labelledby={tabId('compare')} hidden={tab !== 'compare'}>
        {tab === 'compare' && (
          <CompareView
            key={set}
            lang={lang}
            people={people}
            activeId={players.activeId}
            chapters={chapters}
            intro={isFoot ? FOOT_UI.compareIntro[lang] : UI.compareIntro[lang]}
            tallies={tallies}
            foot={isFoot}
            onNewGame={openPlayers}
          />
        )}
      </div>
    </section>
  )
}
