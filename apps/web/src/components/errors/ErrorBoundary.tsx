import { Component, type ErrorInfo, type ReactNode } from 'react'
import { LogoMark } from '@/components/layout/Logo'

type ErrorBoundaryProps = {
  readonly children: ReactNode
  /** Rendered instead of the children after an error; `reset` renders them again. */
  readonly fallback: (reset: () => void) => ReactNode
  readonly onError?: (error: Error, info: ErrorInfo) => void
}

type ErrorBoundaryState = {
  readonly hasError: boolean
}

/**
 * Catches render errors below it. React 19 still needs a class component for
 * this; it is the only one in the codebase.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  private readonly reset = (): void => {
    this.setState({ hasError: false })
  }

  override render(): ReactNode {
    return this.state.hasError ? this.props.fallback(this.reset) : this.props.children
  }
}

type AppCrashScreenProps = {
  readonly onReload?: () => void
}

/** Full-page fallback shown when the app itself fails to render. */
export function AppCrashScreen({ onReload = () => window.location.reload() }: AppCrashScreenProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-page px-6 py-12 text-center">
      <div className="max-w-sm">
        <LogoMark className="mx-auto size-12" />
        <h1 className="mt-5 text-[1.35rem] font-extrabold tracking-[-0.02em] text-ink">Something went wrong</h1>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
          The game hit an unexpected problem. Your scores are safe — they are saved on this device.
        </p>
        <button
          type="button"
          onClick={onReload}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-(--radius-control) bg-coral-600 px-5 text-[0.9rem] font-bold text-white shadow-coral transition hover:bg-coral-700"
        >
          Reload the game
        </button>
      </div>
    </main>
  )
}
