import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeApi } from '@/test/fakeApi'
import { FakeTrolleyScene } from '@/test/fakeTrolleyScene'
import { CHAPTERS } from '../content/dilemmas'
import { PLAYERS_KEY } from '../state/players'
import { PROGRESS_KEY } from '../state/progress'
import { TrolleyGame } from './TrolleyGame'

vi.mock('../scene/TrolleyScene', async () => ({ TrolleyScene: (await import('@/test/fakeTrolleyScene')).FakeTrolleyScene }))

const VOTER = '0b8e4c4e-7d55-4c55-9c1e-3f0f2f5a9b11'

/**
 * Renders the game and, unless told not to, gets through both start screens:
 * who's playing (the most recent player carries on, or a first one starts
 * under the suggested name), then which problems (the absurd ones).
 */
async function renderGame({ soundEnabled = true, start = true } = {}) {
  const slot = document.createElement('header')
  document.body.prepend(slot)
  const onToggleSound = vi.fn()
  const user = userEvent.setup()
  const view = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TrolleyGame headerSlot={slot} isActive isDialogOpen={false} soundEnabled={soundEnabled} onToggleSound={onToggleSound} />
    </QueryClientProvider>,
  )
  if (start) {
    const resume = screen.queryAllByRole('button', { name: /^Continue as / })[0]
    await user.click(resume ?? screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Absurd dilemmas' }))
  }
  return { ...view, slot, user, onToggleSound }
}

const header = (slot: HTMLElement) => within(slot)

interface SavedPlayers {
  readonly list?: readonly { readonly id: string; readonly name: string; readonly progress: Record<string, unknown> }[]
  readonly activeId?: string
  readonly music?: boolean
}

const savedPlayers = (): SavedPlayers => JSON.parse(localStorage.getItem(PLAYERS_KEY) ?? '{}') as SavedPlayers

/** The saved game of whoever is playing. */
function savedGame(): Record<string, unknown> {
  const players = savedPlayers()
  return players.list?.find((player) => player.id === players.activeId)?.progress ?? {}
}

beforeEach(() => {
  FakeTrolleyScene.reset()
  localStorage.clear()
  document.documentElement.lang = 'en'
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.querySelectorAll('body > header').forEach((element) => element.remove())
})

describe('TrolleyGame', () => {
  it('draws its own header: logo, centred tabs, counter and controls', async () => {
    installFakeApi()
    const { slot } = await renderGame()

    expect(header(slot).getByRole('heading', { level: 1, name: 'Absurd Trolley Problems' })).toBeInTheDocument()
    expect(header(slot).getByRole('link', { name: 'All games' })).toHaveAttribute('href', '/')
    expect(header(slot).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Play', 'Dilemmas', 'Community', 'Compare'])
    expect(header(slot).getByLabelText('Dilemma 1 / 12')).toBeInTheDocument()
    expect(header(slot).getByRole('group', { name: 'Language' })).toBeInTheDocument()
    expect(await header(slot).findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '#account')
    expect(screen.getByRole('heading', { level: 2, name: /5 influencers or the last cat\?/ })).toBeInTheDocument()
    expect(screen.getByText('A runaway tram is coming. Your call.')).toBeInTheDocument()
    await waitFor(() => expect(FakeTrolleyScene.latest().setDilemma).toHaveBeenCalled())
    expect(FakeTrolleyScene.latest().dilemma?.id).toBe('influencers-vs-last-cat')
  })

  it('plays a choice, votes and shows how the community decided', async () => {
    const fetchMock = installFakeApi({ trolleyTallies: { 'influencers-vs-last-cat': { pull: 63, stay: 36 } } })
    const { user } = await renderGame()
    await waitFor(() => expect(FakeTrolleyScene.instances.length).toBe(1))

    await user.click(screen.getByRole('button', { name: 'Pull the lever' }))

    expect(await screen.findByText(/64% of the community pulled the lever\./)).toBeInTheDocument()
    expect(screen.getByText(/100 votes/)).toBeInTheDocument()
    expect(screen.getByText('The internet is now nothing but dog videos.')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Research' })).toHaveTextContent('Moral Machine')
    expect(screen.getByRole('button', { name: 'Pull the lever' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Pull the lever' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Next dilemma/ })).toBeEnabled()
    const vote = fetchMock.mock.calls.find(([input]) => String(input).includes('/api/trolley/votes'))
    expect(JSON.parse(String(vote?.[1]?.body))).toMatchObject({ dilemmaId: 'influencers-vs-last-cat', choice: 'pull' })
    // The cat was the only life on the lever's side.
    expect(screen.getByLabelText('Kill count: 1')).toBeInTheDocument()
  })

  it('moves on with the keyboard: D does nothing, Enter goes to the next dilemma', async () => {
    installFakeApi()
    const { user, slot } = await renderGame()
    await waitFor(() => expect(FakeTrolleyScene.instances.length).toBe(1))

    await user.keyboard('d')
    expect(await screen.findByText(/Their followers are still waiting/)).toBeInTheDocument()
    expect(screen.getByLabelText('Kill count: 5')).toBeInTheDocument()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { level: 2, name: /The classic: 5 people or 1\?/ })).toBeInTheDocument()
    expect(header(slot).getByLabelText('Dilemma 2 / 12')).toBeInTheDocument()
    expect(savedGame()).toMatchObject({ index: 1, answers: { 'influencers-vs-last-cat': 'stay' } })
  })

  it('switches tabs: every dilemma, then the community’s votes', async () => {
    installFakeApi({ trolleyTallies: { footbridge: { pull: 51, stay: 49 }, 'cats-vs-dog': { pull: 10, stay: 90 } } })
    const { user, slot } = await renderGame()

    await user.click(header(slot).getByRole('tab', { name: 'Dilemmas' }))
    expect(screen.getAllByRole('button', { name: /Play this dilemma/ })).toHaveLength(24)
    expect(screen.getByRole('heading', { level: 3, name: 'Chapter 2' })).toBeInTheDocument()

    await user.click(header(slot).getByRole('tab', { name: 'Community' }))
    expect(await screen.findByText('Most divisive')).toBeInTheDocument()
    const divisive = screen.getByText('Most divisive').closest('div')
    expect(divisive).toHaveTextContent(/51%/)

    await user.click(header(slot).getByRole('tab', { name: 'Dilemmas' }))
    await user.click(screen.getAllByRole('button', { name: /Play this dilemma/ })[12] as HTMLElement)
    expect(header(slot).getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('button', { name: 'Push him' })).toBeInTheDocument()
  })

  it('moves between tabs with the arrow keys', async () => {
    installFakeApi()
    const { user, slot } = await renderGame()
    header(slot).getByRole('tab', { name: 'Play' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(header(slot).getByRole('tab', { name: 'Dilemmas' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(header(slot).getByRole('tab', { name: 'Compare' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(header(slot).getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true')
  })

  it('speaks Turkish when asked, and remembers it site-wide', async () => {
    installFakeApi()
    const { user, slot } = await renderGame()

    await user.click(header(slot).getByRole('button', { name: 'TR' }))
    expect(await screen.findByRole('button', { name: 'Kolu çek' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /5 influencer mı, son kedi mi\?/ })).toBeInTheDocument()
    expect(header(slot).getByRole('tab', { name: 'İkilemler' })).toBeInTheDocument()
    expect(localStorage.getItem('games.lang')).toBe('tr')
    await waitFor(() => expect(FakeTrolleyScene.latest().lang).toBe('tr'))
  })

  it('toggles the music and the site sound from the header', async () => {
    installFakeApi()
    const { user, slot, onToggleSound } = await renderGame()

    const music = header(slot).getByRole('button', { name: 'Music' })
    expect(music).toHaveAttribute('aria-pressed', 'true')
    await user.click(music)
    expect(music).toHaveAttribute('aria-pressed', 'false')
    expect(savedPlayers()).toMatchObject({ music: false })

    await user.click(header(slot).getByRole('button', { name: 'Mute sound (M)' }))
    await user.keyboard('m')
    expect(onToggleSound).toHaveBeenCalledTimes(2)
  })

  it('ends a chapter with a summary and starts the next one', async () => {
    installFakeApi()
    const chapterOne = CHAPTERS[0]?.dilemmas ?? []
    const answers = Object.fromEntries(chapterOne.slice(0, 11).map((dilemma) => [dilemma.id, 'stay']))
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ chapter: 0, index: 11, answers, voterId: VOTER, music: false }))
    const { user, slot } = await renderGame()

    await user.click(await screen.findByRole('button', { name: 'Do nothing' }))
    await user.click(await screen.findByRole('button', { name: /See your results/ }))

    expect(await screen.findByRole('heading', { level: 2, name: /Chapter complete/ })).toBeInTheDocument()
    const summary = screen.getByRole('region', { name: /Innocent Bystander/ })
    expect(within(summary).getByText('Lever pulls')).toBeInTheDocument()
    expect(within(summary).getByText('0 / 12')).toBeInTheDocument()

    await user.click(within(summary).getByRole('button', { name: /Go to chapter 2/ }))
    expect(await screen.findByRole('button', { name: 'Push him' })).toBeInTheDocument()
    expect(header(slot).getByLabelText('Dilemma 1 / 12')).toBeInTheDocument()
  })

  it('decides with the lever in the scene, only while the dilemma waits', async () => {
    installFakeApi()
    await renderGame()
    await waitFor(() => expect(FakeTrolleyScene.latest().interactive).toBe(true))

    act(() => FakeTrolleyScene.latest().releaseLever('stay'))

    expect(await screen.findByText(/Their followers are still waiting/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Do nothing' })).toHaveAttribute('aria-pressed', 'true')
    expect(FakeTrolleyScene.latest().interactive).toBe(false)
    // The result sits over the scene: the bar, the line under it and the way on.
    expect(screen.getByRole('button', { name: /Next dilemma/ })).toBeEnabled()
  })

  it('has no lever to grab on the footbridge', async () => {
    installFakeApi()
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ chapter: 1, index: 0, answers: {}, voterId: VOTER }))
    await renderGame()

    expect(await screen.findByRole('button', { name: 'Push him' })).toBeInTheDocument()
    await waitFor(() => expect(FakeTrolleyScene.latest().setInteractive).toHaveBeenCalled())
    expect(FakeTrolleyScene.latest().interactive).toBe(false)
  })

  it('ends the last chapter with a way back, a replay, the dilemmas and a result to share', async () => {
    installFakeApi()
    const chapterTwo = CHAPTERS[1]?.dilemmas ?? []
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ chapter: 1, index: 12, answers: Object.fromEntries(chapterTwo.map((dilemma) => [dilemma.id, 'pull'])), voterId: VOTER, music: false }))
    const { user, slot } = await renderGame()
    // After user-event's setup, which brings its own clipboard.
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    expect(await screen.findByRole('heading', { level: 2, name: /Chapter complete/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy my result' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^Absurd Trolley Problems · Chapter 2: “.+”\. \d+ lives lost, 12 lever pulls\./))
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Browse the dilemmas' }))
    expect(header(slot).getByRole('tab', { name: 'Dilemmas' })).toHaveAttribute('aria-selected', 'true')
    await user.click(header(slot).getByRole('tab', { name: 'Play' }))
    await user.click(await screen.findByRole('button', { name: /Back to chapter 1/ }))
    expect(await screen.findByRole('heading', { level: 2, name: /5 influencers or the last cat\?/ })).toBeInTheDocument()
  })

  it('keeps the button when the clipboard says no, and replays a chapter', async () => {
    installFakeApi()
    const chapterOne = CHAPTERS[0]?.dilemmas ?? []
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ chapter: 0, index: 12, answers: Object.fromEntries(chapterOne.map((dilemma) => [dilemma.id, 'stay'])), voterId: VOTER, music: false }))
    const { user } = await renderGame()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true })

    await user.click(await screen.findByRole('button', { name: 'Copy my result' }))
    expect(screen.getByRole('button', { name: 'Copy my result' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Replay this chapter' }))
    expect(await screen.findByRole('heading', { level: 2, name: /5 influencers or the last cat\?/ })).toBeInTheDocument()
  })

  it('takes back a choice from the Dilemmas tab, so it can be played again', async () => {
    installFakeApi()
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ chapter: 0, index: 0, answers: { 'influencers-vs-last-cat': 'pull', 'classic-five-vs-one': 'stay' }, voterId: VOTER }))
    const { user, slot } = await renderGame()
    await waitFor(() => expect(FakeTrolleyScene.latest().settled).toBe('pull'))
    // The cat, then five people on the classic.
    expect(screen.getByLabelText('Kill count: 6')).toBeInTheDocument()

    await user.click(header(slot).getByRole('tab', { name: 'Dilemmas' }))
    const card = screen.getByRole('heading', { level: 4, name: '5 influencers or the last cat?' }).closest('li') as HTMLElement
    expect(within(card).getByText('Your choice: Pull the lever')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'See the result' })).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Reset' }))

    expect(within(card).getByText('Not played yet')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Player 1: “5 influencers or the last cat?” has been reset.')
    expect(savedGame().answers).toEqual({ 'classic-five-vs-one': 'stay' })
    // The scene puts the tram and everyone back.
    expect(FakeTrolleyScene.latest().setDilemma).toHaveBeenCalledTimes(2)
    expect(FakeTrolleyScene.latest().settled).toBeNull()

    await user.click(within(card).getByRole('button', { name: 'Play this dilemma' }))
    expect(await screen.findByRole('button', { name: 'Pull the lever' })).toBeEnabled()
    expect(screen.getByLabelText('Kill count: 5')).toBeInTheDocument()
  })

  it('resets a whole chapter on a second press, then plays it from the start', async () => {
    installFakeApi()
    const chapterOne = CHAPTERS[0]?.dilemmas ?? []
    const answers = { ...Object.fromEntries(chapterOne.map((dilemma) => [dilemma.id, 'stay'])), footbridge: 'pull' }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ chapter: 0, index: 12, answers, voterId: VOTER }))
    const { user, slot } = await renderGame()

    await user.click(header(slot).getByRole('tab', { name: 'Dilemmas' }))
    const chapter = screen.getByRole('region', { name: 'Chapter 1' })
    expect(within(chapter).getByText('12 of 12 played')).toBeInTheDocument()
    const reset = within(chapter).getByRole('button', { name: 'Reset chapter' })
    await user.click(reset)
    expect(reset).toHaveTextContent('Sure? Reset it')
    expect(screen.getByRole('status')).toHaveTextContent('Reset Chapter 1 for Player 1? Press again to confirm.')
    expect(within(chapter).getByText('12 of 12 played')).toBeInTheDocument()
    await user.click(reset)

    expect(within(chapter).getByText('0 of 12 played')).toBeInTheDocument()
    expect(within(chapter).queryByRole('button', { name: /Reset chapter|Sure/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Player 1: Chapter 1 has been reset.')
    // The other chapter keeps its answer.
    const chapterTwo = screen.getByRole('region', { name: 'Chapter 2' })
    expect(within(chapterTwo).getByText('1 of 12 played')).toBeInTheDocument()
    expect(within(chapterTwo).getByRole('button', { name: 'Play from the start' })).toBeInTheDocument()

    await user.click(within(chapter).getByRole('button', { name: 'Play this chapter' }))
    expect(header(slot).getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('heading', { level: 2, name: /5 influencers or the last cat\?/ })).toBeInTheDocument()
    expect(header(slot).getByLabelText('Dilemma 1 / 12')).toBeInTheDocument()
  })

  it('opens on who’s playing, and keeps each player’s game apart', async () => {
    const fetchMock = installFakeApi()
    const { user, slot } = await renderGame({ start: false })
    const votes = () => fetchMock.mock.calls.filter(([input]) => String(input).includes('/api/trolley/votes')).map(([, init]) => JSON.parse(String(init?.body)) as { voterId: string })

    // A first visit goes straight to the new-game form; the keys wait for a player.
    expect(screen.getByRole('heading', { level: 2, name: /Who’s playing\?/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pull the lever' })).not.toBeInTheDocument()
    await user.keyboard('a')
    expect(votes()).toEqual([])
    const name = screen.getByRole('textbox', { name: 'Your name' })
    expect(name).toHaveValue('Player 1')
    await user.clear(name)
    await user.type(name, 'Sam')
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Absurd dilemmas' }))

    await user.click(screen.getByRole('button', { name: 'Pull the lever' }))
    expect(await screen.findByLabelText('Kill count: 1')).toBeInTheDocument()
    // The chip by the kill count says whose game it is, and brings back the start screen.
    await user.click(screen.getByRole('button', { name: 'Switch player (Sam)' }))
    expect(screen.getByText('1/24 dilemmas · 0/21 cases · 1 victim')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /New game/ }))
    const second = screen.getByRole('textbox', { name: 'Your name' })
    expect(second).toHaveFocus()
    expect(second).toHaveValue('Player 2')
    await user.clear(second)
    await user.type(second, 'Alex')
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Absurd dilemmas' }))

    // Alex starts afresh on the same first dilemma.
    expect(await screen.findByRole('button', { name: 'Pull the lever' })).toBeEnabled()
    expect(screen.getByLabelText('Kill count: 0')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Do nothing' }))
    expect(await screen.findByLabelText('Kill count: 5')).toBeInTheDocument()
    // Each votes under their own anonymous id.
    expect(votes()).toHaveLength(2)
    expect(votes()[0]?.voterId).not.toBe(votes()[1]?.voterId)

    await user.click(header(slot).getByRole('tab', { name: 'Compare' }))
    expect(screen.getByRole('combobox', { name: 'Player one' })).toHaveDisplayValue('Alex')
    expect(screen.getByRole('combobox', { name: 'Player two' })).toHaveDisplayValue('Sam')
    expect(screen.getByText('0% in agreement')).toBeInTheDocument()
    expect(screen.getByText('The same call on 0 of 1 shared dilemmas')).toBeInTheDocument()
    expect(screen.getByText('Complete opposites!')).toBeInTheDocument()
    expect(screen.getByText('Sam lost 4 fewer lives.')).toBeInTheDocument()
    const row = screen.getByText('5 influencers or the last cat?', { selector: '.atp-vs-title' }).closest('li') as HTMLElement
    expect(within(row).getByText('Alex: Do nothing')).toBeInTheDocument()
    expect(within(row).getByText('Sam: Pull the lever')).toBeInTheDocument()
    expect(within(row).getByText('You differ')).toBeInTheDocument()
    // Picking the other side's player swaps the two.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Player one' }), 'Sam')
    expect(screen.getByRole('combobox', { name: 'Player two' })).toHaveDisplayValue('Alex')
    await user.click(screen.getByRole('checkbox', { name: 'Only show where you differ' }))
    expect(screen.getByText('5 influencers or the last cat?', { selector: '.atp-vs-title' })).toBeInTheDocument()
  })

  it('suggests a name in the site’s language until one is typed', async () => {
    installFakeApi()
    const { user, slot } = await renderGame({ start: false })
    const name = screen.getByRole('textbox', { name: 'Your name' })
    expect(name).toHaveValue('Player 1')

    await user.click(header(slot).getByRole('button', { name: 'TR' }))
    expect(screen.getByRole('textbox', { name: 'Adın' })).toHaveValue('Oyuncu 1')
    await user.type(screen.getByRole('textbox', { name: 'Adın' }), 'x')
    await user.click(header(slot).getByRole('button', { name: 'EN' }))
    expect(screen.getByRole('textbox', { name: 'Your name' })).toHaveValue('Oyuncu 1x')
  })

  it('checks new names, and deletes a player only once confirmed', async () => {
    installFakeApi()
    const seeded = (id: string, name: string, lastPlayed: number) => ({ id, name, color: '#7fe3b8', progress: { chapter: 0, index: 0, answers: { footbridge: 'pull' }, voterId: VOTER }, lastPlayed })
    localStorage.setItem(PLAYERS_KEY, JSON.stringify({ list: [seeded('11111111-2222-4333-8444-555555555555', 'Sam', 2), seeded('66666666-7777-4888-8999-aaaaaaaaaaaa', 'Alex', 1)], activeId: '11111111-2222-4333-8444-555555555555', music: true }))
    const { user } = await renderGame({ start: false })

    expect(screen.getAllByRole('button', { name: /^Continue as / }).map((button) => button.getAttribute('aria-label'))).toEqual(['Continue as Sam', 'Continue as Alex'])
    expect(screen.getByText('Last played')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /New game/ }))
    const name = screen.getByRole('textbox', { name: 'Your name' })
    await user.clear(name)
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Type a name.')
    await user.type(name, ' sam ')
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('alert')).toHaveTextContent('There’s already a player with that name.')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Delete: Alex' }))
    expect(screen.getByText('Delete Alex? All their choices go too.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Delete: Alex' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.queryByRole('button', { name: 'Continue as Alex' })).not.toBeInTheDocument()
    expect(savedPlayers().list?.map((player) => player.name)).toEqual(['Sam'])
    // Nothing to go back to until a game has been entered.
    expect(screen.queryByRole('button', { name: 'Back to the game' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue as Sam' }))
    await user.click(screen.getByRole('button', { name: 'Absurd dilemmas' }))
    expect(await screen.findByRole('button', { name: 'Pull the lever' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Switch player (Sam)' }))
    await user.click(screen.getByRole('button', { name: 'Back to the game' }))
    expect(await screen.findByRole('button', { name: 'Pull the lever' })).toBeInTheDocument()
  })

  it('starts a first player on the dilemma they asked for', async () => {
    installFakeApi()
    const { user, slot } = await renderGame({ start: false })

    await user.click(header(slot).getByRole('tab', { name: 'Dilemmas' }))
    expect(screen.getByText('No game yet: first say who’s playing.')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Play this dilemma/ })[12] as HTMLElement)
    expect(screen.getByRole('heading', { level: 2, name: /Who’s playing\?/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(await screen.findByRole('button', { name: 'Push him' })).toBeInTheDocument()
    await user.click(header(slot).getByRole('tab', { name: 'Dilemmas' }))
    expect(screen.getByText('Player 1', { selector: 'strong' })).toBeInTheDocument()
  })

  it('needs two players to compare', async () => {
    installFakeApi()
    const { user, slot } = await renderGame()

    await user.click(header(slot).getByRole('tab', { name: 'Compare' }))
    expect(screen.getByText('You need at least two players to compare.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /New game/ }))
    expect(header(slot).getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { level: 2, name: /Who’s playing\?/ })).toBeInTheDocument()
  })

  it('asks who’s playing first, then which problems, with a way back from both', async () => {
    installFakeApi()
    const { user, slot } = await renderGame({ start: false })

    expect(screen.getByRole('heading', { level: 2, name: /Who’s playing\?/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('heading', { level: 2, name: /Which problems\?/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'The original problems' })).toHaveAccessibleDescription(/1967 essay/)
    expect(screen.getByRole('button', { name: 'Absurd dilemmas' })).toHaveAccessibleDescription(/last cat/)
    expect(screen.getByText('0 of 21 cases played')).toBeInTheDocument()
    expect(screen.getByText('0 of 24 dilemmas played')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to the game' })).not.toBeInTheDocument()
    // The keys wait for a game.
    await user.keyboard('a')
    expect(screen.getByRole('heading', { level: 2, name: /Which problems\?/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Players' }))
    expect(screen.getByRole('heading', { level: 2, name: /Who’s playing\?/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue as Player 1' }))
    await user.click(screen.getByRole('button', { name: 'The original problems' }))
    expect(await screen.findByRole('heading', { level: 2, name: /You drive the tram: five workers or one\?/ })).toBeInTheDocument()
    expect(header(slot).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Play', 'Cases', 'Community', 'Compare'])
    expect(header(slot).getByLabelText('Case 1 / 21')).toBeInTheDocument()

    // Once in a game, the problems can be changed, or the screen closed again.
    await user.click(screen.getByRole('button', { name: 'Choose other problems' }))
    expect(screen.getByRole('heading', { level: 2, name: /Which problems\?/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to the game' }))
    expect(screen.getByRole('heading', { level: 2, name: /You drive the tram/ })).toBeInTheDocument()
  })

  it('stays playable when the 3D scene cannot start', async () => {
    installFakeApi({ isDown: true })
    FakeTrolleyScene.failNext = true
    const { user } = await renderGame()

    expect(await screen.findByText(/couldn’t start in this browser/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Do nothing' }))
    expect(await screen.findByText(/Their followers are still waiting/)).toBeInTheDocument()
    // The vote failed, but the player still sees their own.
    await waitFor(() => expect(screen.getByText(/0% of the community pulled the lever\./)).toBeInTheDocument())
  })

  it('reopens a decided dilemma with its aftermath', async () => {
    installFakeApi()
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ chapter: 0, index: 0, answers: { 'influencers-vs-last-cat': 'pull' }, voterId: VOTER }))
    await renderGame()
    await waitFor(() => expect(FakeTrolleyScene.latest().setDilemma).toHaveBeenCalled())
    expect(FakeTrolleyScene.latest().settled).toBe('pull')
    expect(screen.getByRole('button', { name: /Next dilemma/ })).toBeEnabled()
    await act(async () => {
      await Promise.resolve()
    })
  })
})
