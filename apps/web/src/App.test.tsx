import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { navigate } from './app/router'
import type { SoundPlayer } from '@/games/trap-the-orb/audio/sfx'
import { GameControllerProvider } from '@/games/trap-the-orb/state/GameControllerProvider'
import { PlayerDataProvider } from '@/games/trap-the-orb/state/PlayerDataProvider'
import { createPlayerStore } from '@/games/trap-the-orb/state/playerStore'
import { createMemoryStore } from '@/games/trap-the-orb/storage/memoryStore'
import { installFakeApi } from './test/fakeApi'

const fakeSound = (): SoundPlayer => ({ play: vi.fn(), unlock: vi.fn(), setEnabled: vi.fn() })

function renderApp(path = '/trap-the-orb', store = createPlayerStore(createMemoryStore(), fakeSound())) {
  window.history.replaceState(null, '', path)
  const user = userEvent.setup()
  const view = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PlayerDataProvider store={store}>
        <GameControllerProvider>
          <App />
        </GameControllerProvider>
      </PlayerDataProvider>
    </QueryClientProvider>,
  )
  return { ...view, store, user }
}

const openDialog = (): HTMLDialogElement | null => document.querySelector('dialog[open]')
const gameSection = (): HTMLElement => {
  const section = document.getElementById('play')
  if (!section) throw new Error('game section missing')
  return section
}

beforeEach(() => {
  installFakeApi()
  // jsdom has no layout; give the canvas a desktop-sized box so the game can start.
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 480 }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('renders the game page with its main areas', async () => {
    renderApp()

    expect(screen.getByRole('heading', { level: 1, name: /trap the orb/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Level 1' })).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('group', { name: /game status/i })).toBeInTheDocument()
    expect(screen.getByRole('application', { name: 'Trap The Orb playing field' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Advertisement' })).toHaveTextContent('Your ad here')
    expect(screen.getByRole('heading', { name: /mobile apps · coming soon/i })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '#account')
  })

  it('shows the live leaderboard of the selected mode next to the game', async () => {
    renderApp()

    const card = screen.getByRole('region', { name: 'Leaderboard' })
    expect(await within(card).findByText('GridMaster')).toBeInTheDocument()
    expect(within(card).getByText('48,200')).toBeInTheDocument()
    expect(within(card).getByText('Classic · This week')).toBeInTheDocument()
  })

  it('keeps playing as a guest when the server is down', async () => {
    installFakeApi({ isDown: true })
    const { user } = renderApp()

    const card = screen.getByRole('region', { name: 'Leaderboard' })
    expect(await within(card).findByText(/can’t be loaded/i)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /play classic/i }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('starts, pauses and resumes a guest run', async () => {
    const { user } = renderApp()

    await user.click(await screen.findByRole('button', { name: /play classic/i }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()

    await user.keyboard('p')
    const pausedPanel = screen.getByRole('dialog', { name: 'Paused' })
    await user.click(within(pausedPanel).getByRole('button', { name: /resume/i }))
    expect(screen.queryByRole('heading', { name: 'Paused' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('opens dialogs from the navigation and closes them again', async () => {
    const { user } = renderApp()

    await user.click(screen.getAllByRole('link', { name: 'How to play' })[0]!)

    expect(await screen.findByRole('heading', { name: 'How to play' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Goal' })).toBeInTheDocument()
    expect(openDialog()).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(openDialog()).toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('opens a dialog straight from a shared link', async () => {
    renderApp('/trap-the-orb#privacy')

    expect(await screen.findByRole('heading', { name: 'Privacy policy' })).toBeInTheDocument()
    expect(await screen.findByText(/Effective September 24, 2026/)).toBeInTheDocument()
  })

  it('pauses a running game while a privacy dialog is open', async () => {
    const { user } = renderApp()
    await user.click(await screen.findByRole('button', { name: /play classic/i }))

    await user.click(screen.getAllByRole('link', { name: 'Privacy' })[0]!)

    expect(await screen.findByRole('heading', { name: 'Privacy policy' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Paused' })).toBeInTheDocument())
  })

  it('navigates to the About page and keeps the run paused when returning', async () => {
    const { user } = renderApp()
    await user.click(await screen.findByRole('button', { name: /play classic/i }))

    await user.click(screen.getAllByRole('link', { name: 'About' })[0]!)
    expect(await screen.findByRole('heading', { name: 'About games.mucahid.dev' })).toBeInTheDocument()
    expect(document.querySelector('#play')).not.toBeVisible()

    act(() => navigate('/trap-the-orb'))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Paused' })).toBeInTheDocument())
  })

  it('toggles sound from the header and with the M key', async () => {
    const { user, store } = renderApp()
    const toggle = screen.getByRole('button', { name: /mute sound/i })

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await user.click(toggle)
    expect(store.getSnapshot().settings.soundEnabled).toBe(false)
    expect(screen.getByRole('button', { name: /turn sound on/i })).toHaveAttribute('aria-pressed', 'false')

    await user.keyboard('m')
    expect(store.getSnapshot().settings.soundEnabled).toBe(true)
  })

  it('opens and closes the mobile menu', async () => {
    const { user } = renderApp()
    const button = screen.getByRole('button', { name: 'Open menu' })

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const menu = document.getElementById(button.getAttribute('aria-controls') ?? '')
    expect(menu).not.toHaveAttribute('hidden')

    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus()
  })

  it('lets keyboard players aim and build from the board', async () => {
    const { user } = renderApp()
    await user.click(await screen.findByRole('button', { name: /play classic/i }))
    const board = screen.getByRole('application', { name: 'Trap The Orb playing field' })

    board.focus()
    await user.keyboard('{ArrowRight}{ArrowDown} {Enter}')

    expect(screen.getByRole('button', { name: /wall direction: horizontal/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })
})

describe('modes', () => {
  const modeMenu = () => screen.getByRole('navigation', { name: 'Game modes' })

  it('picks a mode from the start menu and puts it in the URL', async () => {
    const { user, store } = renderApp()

    expect(within(modeMenu()).getByRole('link', { name: /Classic/ })).toHaveAttribute('aria-current', 'true')
    await user.click(within(modeMenu()).getByRole('link', { name: /Zen/ }))

    expect(window.location.pathname).toBe('/trap-the-orb/play/zen')
    expect(await screen.findByRole('heading', { name: 'Unlimited lives, no pressure' })).toBeInTheDocument()
    expect(within(modeMenu()).getByRole('link', { name: /Zen/ })).toHaveAttribute('aria-current', 'true')
    expect(store.getSnapshot().settings.lastMode).toBe('zen')
    expect(screen.getByRole('region', { name: 'Leaderboard' })).toHaveTextContent(/for practice/i)
    expect(screen.getByRole('button', { name: 'Play Zen' })).toBeInTheDocument()
  })

  it('shows the Custom setup in the start menu and plays it', async () => {
    const { user, store } = renderApp()

    await user.click(within(modeMenu()).getByRole('link', { name: /Custom/ }))
    const menu = await screen.findByRole('dialog', { name: 'Set up your game' })
    await user.click(within(menu).getByRole('button', { name: 'Hard' }))

    expect(window.location.pathname).toBe('/trap-the-orb/play/custom')
    expect(store.getSnapshot().settings.custom).toMatchObject({ orbCount: 5, walls: 16 })
    const status = screen.getByRole('group', { name: /game status/i })
    expect(await within(status).findByText('Walls')).toBeInTheDocument()
    expect(within(status).getByText('Left')).toBeInTheDocument()
    expect(screen.getByText('5 orbs · clear at 80%')).toBeInTheDocument()

    await user.click(within(menu).getByRole('button', { name: /play custom/i }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('leaves a practice run for the start menu from the pause card', async () => {
    const { user, store } = renderApp('/trap-the-orb/play/zen')
    await user.click(await screen.findByRole('button', { name: 'Play Zen' }))

    await user.keyboard('p')
    const paused = screen.getByRole('dialog', { name: 'Paused' })
    await user.click(within(paused).getByRole('button', { name: 'Change mode' }))

    expect(screen.getByRole('navigation', { name: 'Game modes' })).toBeInTheDocument()
    expect(store.getSnapshot().savedRun).toBeNull()
  })

  it('opens a mode straight from its link', async () => {
    renderApp('/trap-the-orb/play/timeAttack')

    expect(await screen.findByRole('heading', { name: 'Beat the countdown' })).toBeInTheDocument()
    expect(within(modeMenu()).getByRole('link', { name: /Time Attack/ })).toHaveAttribute('aria-current', 'true')
  })
})

describe('runs', () => {
  it('continues a saved practice run', async () => {
    const store = createPlayerStore(createMemoryStore(), fakeSound())
    store.setLastMode('zen')
    store.saveRun({ mode: 'zen', custom: null, level: 3, score: 500 })
    const { user } = renderApp('/trap-the-orb', store)

    expect(await screen.findByRole('heading', { name: 'Continue from level 3' })).toBeInTheDocument()
    // The header's main button continues too.
    expect(screen.getAllByRole('button', { name: /continue/i })).toHaveLength(2)
    const ready = screen.getByRole('dialog', { name: 'Continue from level 3' })
    await user.click(within(ready).getByRole('button', { name: /continue/i }))

    expect(screen.getByRole('heading', { level: 2, name: 'Level 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('ends a ranked guest run from the pause card and shows the result', async () => {
    const { user } = renderApp()
    await user.click(await screen.findByRole('button', { name: /play classic/i }))

    await user.click(screen.getByRole('button', { name: 'End run' }))
    const paused = screen.getByRole('dialog', { name: 'Paused' })
    await user.click(within(paused).getByRole('button', { name: /end run/i }))

    expect(await screen.findByText('Run ended · Classic')).toBeInTheDocument()
    expect(screen.getByText(/to put scores like this on the leaderboards/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Again' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('goes from a result back to the start menu', async () => {
    const { user } = renderApp()
    await user.click(await screen.findByRole('button', { name: /play classic/i }))
    await user.click(screen.getByRole('button', { name: 'End run' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Paused' })).getByRole('button', { name: /end run/i }))
    expect(await screen.findByText('Run ended · Classic')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change mode' }))

    expect(screen.getByRole('heading', { name: 'The original challenge' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Game modes' })).toBeInTheDocument()
  })
})

describe('pages', () => {
  it('shows the leaderboards page and keeps the game in the background', async () => {
    const { user } = renderApp()
    await user.click(await screen.findByRole('button', { name: /play classic/i }))

    await user.click(screen.getAllByRole('link', { name: 'Leaderboards' })[0]!)

    expect(await screen.findByRole('heading', { level: 1, name: 'Leaderboards' })).toBeInTheDocument()
    expect(document.title).toBe('Leaderboards — Trap The Orb')
    expect(gameSection()).not.toBeVisible()
    expect(await screen.findByRole('cell', { name: 'GridMaster' })).toBeInTheDocument()

    await user.click(screen.getAllByRole('link', { name: 'Play' })[0]!)
    expect(gameSection()).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeInTheDocument()
  })

  it('switches leaderboard tables through the URL', async () => {
    const { user } = renderApp('/trap-the-orb/leaderboards')

    await user.click(await screen.findByRole('button', { name: 'Hardcore' }))
    expect(window.location.search).toBe('?board=score.hardcore&period=week')

    await user.click(screen.getByRole('button', { name: 'All time' }))
    expect(window.location.search).toBe('?board=score.hardcore&period=all')

    await user.click(screen.getByRole('tab', { name: 'Records' }))
    expect(window.location.search).toBe('?board=stat.tightestTrap&period=all')

    await user.click(screen.getByRole('tab', { name: 'This device' }))
    expect(await screen.findByText(/no classic scores on this device/i)).toBeInTheDocument()
  })

  it('sends old leaderboard links to the leaderboards page', async () => {
    renderApp('/#leaderboard')

    expect(await screen.findByRole('heading', { level: 1, name: 'Leaderboards' })).toBeInTheDocument()
  })

  it('asks guests to sign in on the profile page', async () => {
    const { user } = renderApp('/profile')

    expect(await screen.findByRole('heading', { level: 1, name: 'Your profile' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Sign in' }))

    const dialog = await screen.findByRole('dialog', { name: 'Your account' })
    expect(await within(dialog).findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Email')).toBeInTheDocument()
  })

  it('shows a not-found page for unknown paths', async () => {
    renderApp('/nope')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(document.title).toBe('Page not found — games.mucahid.dev')
    expect(gameSection()).not.toBeVisible()
  })

  it('closes a dialog when the player navigates back', async () => {
    const { user } = renderApp()
    await user.click(screen.getAllByRole('link', { name: 'How to play' })[0]!)
    await screen.findByRole('heading', { name: 'How to play' })

    act(() => {
      window.location.hash = ''
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    await waitFor(() => expect(openDialog()).toBeNull())
  })
})

describe('board accessibility', () => {
  it('keeps overlay controls outside the application region', async () => {
    renderApp()
    const board = screen.getByRole('application', { name: 'Trap The Orb playing field' })

    expect(await screen.findByRole('button', { name: /play classic/i })).toBeInTheDocument()
    expect(within(board).queryAllByRole('button')).toHaveLength(0)
  })
})

describe('game status bar', () => {
  it('shows area, lives, orb speed, time and score', () => {
    renderApp()
    const status = screen.getByRole('group', { name: /game status/i })

    for (const label of ['Area', 'Lives', 'Speed', 'Time', 'Score']) {
      expect(within(status).getByText(label)).toBeInTheDocument()
    }
    expect(within(status).getByLabelText('Fastest orb 1.00×, calm')).toBeInTheDocument()
  })

  it('switches the wall direction from the control bar', async () => {
    const { user } = renderApp()

    await user.click(screen.getByRole('button', { name: /wall direction: vertical/i }))

    expect(screen.getByRole('button', { name: /wall direction: horizontal/i })).toBeInTheDocument()
  })
})
