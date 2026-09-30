import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AppCrashScreen, ErrorBoundary } from './ErrorBoundary'

function Bomb({ shouldThrow }: { readonly shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom')
  return <p>All good</p>
}

describe('ErrorBoundary', () => {
  it('renders children while nothing fails', () => {
    render(
      <ErrorBoundary fallback={() => <p>Broken</p>}>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('shows the fallback and reports the error when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const onError = vi.fn()

    render(
      <ErrorBoundary fallback={() => <p>Broken</p>} onError={onError}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Broken')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }), expect.anything())
  })

  it('can try again after the problem goes away', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()

    function Harness() {
      const [shouldThrow, setShouldThrow] = useState(true)
      return (
        <ErrorBoundary
          fallback={(reset) => (
            <button
              type="button"
              onClick={() => {
                setShouldThrow(false)
                reset()
              }}
            >
              Retry
            </button>
          )}
        >
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(screen.getByText('All good')).toBeInTheDocument()
  })
})

describe('AppCrashScreen', () => {
  it('reassures the player and offers a reload', async () => {
    const reload = vi.fn()
    const user = userEvent.setup()
    render(<AppCrashScreen onReload={reload} />)

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    expect(screen.getByText(/scores are safe/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reload/i }))
    expect(reload).toHaveBeenCalledOnce()
  })
})
