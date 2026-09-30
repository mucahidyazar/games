import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SoundPlayer } from '@/games/trap-the-orb/audio/sfx'
import { PlayerDataProvider } from '@/games/trap-the-orb/state/PlayerDataProvider'
import { createPlayerStore } from '@/games/trap-the-orb/state/playerStore'
import { createMemoryStore } from '@/games/trap-the-orb/storage/memoryStore'
import { DeviceScores } from './DeviceScores'

const fakeSound = (): SoundPlayer => ({ play: vi.fn(), unlock: vi.fn(), setEnabled: vi.fn() })

function setup(isSignedIn = false) {
  const store = createPlayerStore(createMemoryStore(), fakeSound())
  store.submitHighScore({ name: 'Ada', mode: 'classic', score: 900, level: 4 })
  store.submitHighScore({ name: 'Bo', mode: 'hardcore', score: 300, level: 2 })
  render(
    <PlayerDataProvider store={store}>
      <DeviceScores isSignedIn={isSignedIn} />
    </PlayerDataProvider>,
  )
  return { store, user: userEvent.setup() }
}

describe('DeviceScores', () => {
  it('shows this device’s scores one mode at a time', async () => {
    const { user } = setup()

    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'Bo' })).not.toBeInTheDocument()
    expect(screen.getByText(/sign in to put your runs on the global leaderboards/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hardcore' }))
    expect(screen.getByRole('cell', { name: 'Bo' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Time Attack' }))
    expect(screen.getByText(/no time attack scores on this device yet/i)).toBeInTheDocument()
  })

  it('clears the scores after a second click', async () => {
    const { store, user } = setup(true)

    expect(screen.queryByText(/sign in to put your runs/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear device scores' }))
    expect(store.getSnapshot().highScores).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Click again to clear' }))
    expect(store.getSnapshot().highScores).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
  })
})
