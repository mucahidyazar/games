import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeApi } from '@/test/fakeApi'
import { FakeTrolleyScene } from '@/test/fakeTrolleyScene'
import { FOOT_DILEMMAS, OTHER_FOOT_CASES } from '../content/foot'
import { PLAYERS_KEY } from '../state/players'
import { TrolleyGame } from './TrolleyGame'

vi.mock('../scene/TrolleyScene', async () => ({ TrolleyScene: (await import('@/test/fakeTrolleyScene')).FakeTrolleyScene }))

const VOTER = '0b8e4c4e-7d55-4c55-9c1e-3f0f2f5a9b11'

/** Asks for less motion, so the motion scenes play each choice out at once. */
function preferReducedMotion(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  )
}

type Tallies = Parameters<typeof installFakeApi>[0] extends infer Options ? (Options extends { trolleyTallies?: infer T } ? T : never) : never

/** Renders the game; unless told otherwise, a first player starts and opens Philippa Foot's problems. */
async function renderFoot({ start = true, trolleyTallies = {} as Tallies } = {}) {
  const slot = document.createElement('header')
  document.body.prepend(slot)
  const user = userEvent.setup()
  const fetchMock = installFakeApi({ trolleyTallies })
  const view = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TrolleyGame headerSlot={slot} isActive isDialogOpen={false} soundEnabled onToggleSound={vi.fn()} />
    </QueryClientProvider>,
  )
  if (start) {
    const resume = screen.queryAllByRole('button', { name: /^Continue as / })[0]
    await user.click(resume ?? screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'The original problems' }))
  }
  const votes = () =>
    fetchMock.mock.calls.filter(([input]) => String(input).includes('/api/trolley/votes')).map(([, init]) => JSON.parse(String(init?.body)) as { dilemmaId: string; choice: string })
  return { ...view, slot, user, votes }
}

const header = (slot: HTMLElement) => within(slot)

interface SavedPlayers {
  readonly list?: readonly { readonly id: string; readonly name: string; readonly progress: { readonly foot?: number; readonly answers?: Record<string, string> } }[]
  readonly activeId?: string
}

const savedPlayers = (): SavedPlayers => JSON.parse(localStorage.getItem(PLAYERS_KEY) ?? '{}') as SavedPlayers

beforeEach(() => {
  FakeTrolleyScene.reset()
  localStorage.clear()
  document.documentElement.lang = 'en'
  preferReducedMotion()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.querySelectorAll('body > header').forEach((element) => element.remove())
})

describe("Philippa Foot's problems", () => {
  it('play in motion, with Foot’s own answer and the community’s vote', async () => {
    const { user, slot, votes } = await renderFoot({ trolleyTallies: { 'foot-driver': { pull: 63, stay: 36 } } })

    expect(screen.getByText('Philippa Foot · 1967 · Case 1 of 21')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Animated drawing: the tram/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep straight' })).toBeInTheDocument()
    expect(header(slot).getByLabelText('Case 1 / 21')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Steer away' }))
    expect(await screen.findByText('You steered away.')).toBeInTheDocument()
    expect(screen.getByText(/64% of the community steered away\./)).toBeInTheDocument()
    const foot = screen.getByRole('complementary', { name: 'What would Foot say?' })
    expect(foot).toHaveTextContent('Steer away')
    expect(foot).toHaveTextContent('You chose the same.')
    expect(foot).toHaveTextContent('Philippa Foot, Oxford Review 5 (1967)')
    expect(screen.getByLabelText('Victim count: 1')).toBeInTheDocument()
    expect(votes()).toEqual([expect.objectContaining({ dilemmaId: 'foot-driver', choice: 'pull' })])

    // The player's place in Foot's cases is kept with the rest of their game.
    await user.click(screen.getByRole('button', { name: /Next case/ }))
    expect(await screen.findByRole('heading', { level: 2, name: /You are the judge/ })).toBeInTheDocument()
    const saved = savedPlayers().list?.[0]?.progress
    expect(saved).toMatchObject({ foot: 1, answers: { 'foot-driver': 'pull' } })
  })

  it('play every case to Foot’s end card, then again', async () => {
    const { user } = await renderFoot()
    for (const [index, dilemma] of FOOT_DILEMMAS.entries()) {
      expect(await screen.findByRole('heading', { level: 2, name: new RegExp(dilemma.title.en.slice(0, 20).replace(/[?:]/g, '.')) })).toBeInTheDocument()
      await user.keyboard(index % 2 === 0 ? 'a' : 'd')
      await screen.findByText(dilemma.verbs?.you?.[index % 2 === 0 ? 'pull' : 'stay'].en ?? '')
      await user.keyboard('{Enter}')
    }

    expect(await screen.findByRole('heading', { level: 2, name: /You and Foot/ })).toBeInTheDocument()
    expect(screen.getByText(/You sided with Foot on \d+ of the 19 cases she answered\./)).toBeInTheDocument()
    const card = screen.getByRole('region', { name: 'You and Foot' })
    // A profile, the agreement, then every case under the distinction it falls on.
    expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent(/In Foot’s footsteps|The utilitarian|Clean hands|Your own way/)
    expect(within(card).getByRole('meter')).toHaveAccessibleName(/You sided with Foot on \d+ of the 19 cases/)
    expect(within(card).getAllByRole('heading', { level: 5 }).map((heading) => heading.textContent)).toEqual([
      'Harm or harm?',
      'Aid or aid?',
      'Harm for the sake of aid',
      'Foreseen deaths',
      'When no one would be spared',
      'The abortion debate',
      'Left open',
    ])
    expect(card.querySelectorAll('button.atp-fs-case')).toHaveLength(FOOT_DILEMMAS.length)
    expect(within(card).getByRole('button', { name: /head outside/ })).toHaveTextContent('Foot left this one open.')

    await user.click(within(card).getByRole('button', { name: 'Play again' }))
    expect(await screen.findByRole('heading', { level: 2, name: /You drive the tram/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Steer away' })).toBeEnabled()
    expect(screen.getByLabelText('Victim count: 0')).toBeInTheDocument()
    // All twenty-one cases, one after another: with the whole workspace testing at once this needs longer than the default.
  }, 60_000)

  it('open a case’s result from a row of Foot’s end card', async () => {
    const answers = Object.fromEntries(FOOT_DILEMMAS.map((dilemma) => [dilemma.id, 'pull']))
    localStorage.setItem(
      PLAYERS_KEY,
      JSON.stringify({
        list: [{ id: '11111111-2222-4333-8444-555555555555', name: 'Sam', color: '#7fe3b8', progress: { chapter: 0, index: 0, answers, foot: FOOT_DILEMMAS.length, voterId: VOTER }, lastPlayed: 1 }],
        activeId: '11111111-2222-4333-8444-555555555555',
        music: true,
      }),
    )
    const { user } = await renderFoot()
    const card = await screen.findByRole('region', { name: 'You and Foot' })
    // Turning to the crash victims is what Foot would do; selling the oil is not.
    expect(within(card).getByRole('button', { name: /The ward and the multiple crash/ })).toHaveAttribute('data-state', 'same')
    expect(within(card).getByRole('button', { name: /The poisoned cooking oil/ })).toHaveTextContent('Foot: Pour it away')
    await user.click(within(card).getByRole('button', { name: /The runaway tram/ }))
    expect(await screen.findByRole('heading', { level: 2, name: /You drive the tram/ })).toBeInTheDocument()
    expect(screen.getByText('You steered away.')).toBeInTheDocument()
  })

  it('list the cases with Foot’s answers, and the essay’s other cases, and take one back', async () => {
    const { user, slot, container } = await renderFoot()
    await user.click(screen.getByRole('button', { name: 'Steer away' }))
    await screen.findByText('You steered away.')

    await user.click(header(slot).getByRole('tab', { name: 'Cases' }))
    expect(screen.getByRole('group', { name: 'Problems' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Play this case|See the result/ })).toHaveLength(FOOT_DILEMMAS.length)
    const card = screen.getByRole('heading', { level: 4, name: /You drive the tram/ }).closest('li') as HTMLElement
    expect(within(card).getByText('Your choice: Steer away')).toBeInTheDocument()
    expect(card).toHaveTextContent('Foot: Steer away')
    const others = screen.getByRole('region', { name: 'The essay’s other cases' })
    expect(within(others).getAllByRole('listitem')).toHaveLength(OTHER_FOOT_CASES.length)
    expect(within(others).getByRole('link', { name: 'Read the essay' })).toHaveAttribute('href', 'https://philpapers.org/rec/FOOTPO-2')

    // Taken back, the case starts over in the scene.
    await user.click(within(card).getByRole('button', { name: 'Reset' }))
    expect(within(card).getByText('Not played yet')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Play this case' }))
    expect(await screen.findByRole('button', { name: 'Steer away' })).toBeEnabled()
    expect(container.querySelector('.atp-m-scene')).toHaveAttribute('data-state', 'waiting')
  })

  it('show the community’s split on Foot’s cases, and switch to the absurd ones there', async () => {
    const { user, slot } = await renderFoot({ trolleyTallies: { 'foot-judge': { pull: 20, stay: 80 }, footbridge: { pull: 51, stay: 49 } } })

    await user.click(header(slot).getByRole('tab', { name: 'Community' }))
    expect(await screen.findByText(/took the first option in each of Foot’s cases/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(FOOT_DILEMMAS.length)
    expect(screen.getByRole('img', { name: /20% framed the innocent man/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Absurd dilemmas' }))
    expect(screen.getByRole('button', { name: 'Absurd dilemmas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('listitem')).toHaveLength(24)
    expect(header(slot).getByRole('tab', { name: 'Dilemmas' })).toBeInTheDocument()
  })

  it('compare one player with Philippa Foot herself', async () => {
    const { user, slot } = await renderFoot()
    await user.click(screen.getByRole('button', { name: 'Steer away' }))
    await screen.findByText('You steered away.')

    await user.click(header(slot).getByRole('tab', { name: 'Compare' }))
    expect(screen.getByRole('combobox', { name: 'Player one' })).toHaveDisplayValue('Player 1')
    expect(screen.getByRole('combobox', { name: 'Player two' })).toHaveDisplayValue('Philippa Foot')
    expect(screen.getByText('100% in agreement')).toBeInTheDocument()
    expect(screen.getByText('The same call on 1 of 1 shared cases')).toBeInTheDocument()
    // Victims and first options, not lives and levers; Foot follows herself.
    const board = screen.getByRole('region', { name: 'Player 1 VS Philippa Foot' })
    expect(within(board).getAllByText('Victims')).toHaveLength(2)
    expect(within(board).getAllByText('First option')).toHaveLength(2)
    expect(within(board).getByText('In Foot’s footsteps')).toBeInTheDocument()

    // The absurd dilemmas need a second player of their own.
    await user.click(screen.getByRole('button', { name: 'Absurd dilemmas' }))
    expect(screen.getByText('You need at least two players to compare.')).toBeInTheDocument()
  })

  it('start a first player on the case they asked for', async () => {
    const { user, slot } = await renderFoot({ start: false })
    await user.click(header(slot).getByRole('tab', { name: 'Dilemmas' }))
    await user.click(screen.getByRole('button', { name: 'The original problems' }))
    await user.click(screen.getAllByRole('button', { name: 'Play this case' })[2] as HTMLElement)
    expect(screen.getByRole('heading', { level: 2, name: /Who’s playing\?/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByRole('heading', { level: 2, name: /You fly the plane/ })).toBeInTheDocument()
  })

  it('keep each player’s cases apart', async () => {
    const seeded = (id: string, name: string, lastPlayed: number, answers: Record<string, string>, foot: number) => ({
      id,
      name,
      color: '#7fe3b8',
      progress: { chapter: 0, index: 0, answers, foot, voterId: VOTER },
      lastPlayed,
    })
    localStorage.setItem(
      PLAYERS_KEY,
      JSON.stringify({
        list: [seeded('11111111-2222-4333-8444-555555555555', 'Sam', 2, { 'foot-driver': 'pull', 'foot-judge': 'stay' }, 2), seeded('66666666-7777-4888-8999-aaaaaaaaaaaa', 'Alex', 1, {}, 0)],
        activeId: '11111111-2222-4333-8444-555555555555',
        music: true,
      }),
    )
    const { user } = await renderFoot({ start: false })
    expect(screen.getByText('0/24 dilemmas · 2/21 cases · 6 victims')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue as Sam' }))
    expect(screen.getByText('2 of 21 cases played')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'The original problems' }))
    expect(await screen.findByRole('heading', { level: 2, name: /You fly the plane/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Switch player (Sam)' }))
    await user.click(screen.getByRole('button', { name: 'Continue as Alex' }))
    await user.click(screen.getByRole('button', { name: 'The original problems' }))
    expect(await screen.findByRole('heading', { level: 2, name: /You drive the tram/ })).toBeInTheDocument()
  })

  it('play the abortion debate’s operations without counting anyone, and say so', async () => {
    const answers = Object.fromEntries(FOOT_DILEMMAS.filter((dilemma) => !dilemma.uncounted).map((dilemma) => [dilemma.id, 'stay']))
    const first = FOOT_DILEMMAS.findIndex((dilemma) => dilemma.uncounted)
    localStorage.setItem(
      PLAYERS_KEY,
      JSON.stringify({
        list: [{ id: '11111111-2222-4333-8444-555555555555', name: 'Sam', color: '#7fe3b8', progress: { chapter: 0, index: 0, answers, foot: first, voterId: VOTER }, lastPlayed: 1 }],
        activeId: '11111111-2222-4333-8444-555555555555',
        music: true,
      }),
    )
    const { user } = await renderFoot()
    expect(await screen.findByRole('heading', { level: 2, name: /cancerous womb/ })).toBeInTheDocument()
    expect(screen.getByText(/Nobody is counted as a victim here/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /operating theatre/ })).toBeInTheDocument()
    const before = screen.getByLabelText(/^Victim count: \d+$/).getAttribute('aria-label')

    await user.click(screen.getByRole('button', { name: 'Wait' }))
    expect(await screen.findByText('You chose to wait.')).toBeInTheDocument()
    expect(screen.getByText(/There was no operation; neither survived\./)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Victim count: \d+$/)).toHaveAttribute('aria-label', before)
  })

  it('decide with a click on the scene', async () => {
    const { container } = await renderFoot()
    fireEvent.click(container.querySelector('.atp-m-hotspot') as Element)
    expect(await screen.findByText('You steered away.')).toBeInTheDocument()
  })

  it('speak Turkish', async () => {
    const { user, slot } = await renderFoot()
    await user.click(header(slot).getByRole('button', { name: 'TR' }))
    expect(await screen.findByRole('heading', { level: 2, name: /Tramvayı sen sürüyorsun/ })).toBeInTheDocument()
    expect(screen.getByText('Philippa Foot · 1967 · Vaka 1 / 21')).toBeInTheDocument()
    expect(header(slot).getByRole('tab', { name: 'Vakalar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Direksiyonu kır' }))
    expect(await screen.findByText('Sen de aynı yolu seçtin.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Toplam kurban sayısı: 1')).toBeInTheDocument())
  })
})
