import type { ReactNode, Ref } from 'react'

type ActionButtonProps = {
  readonly children: ReactNode
  readonly onClick?: () => void
  readonly type?: 'button' | 'submit'
  readonly variant?: 'primary' | 'secondary'
  readonly isBusy?: boolean
  readonly disabled?: boolean
  readonly ref?: Ref<HTMLButtonElement>
}

export function ActionButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  isBusy = false,
  disabled = false,
  ref,
}: ActionButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-coral-600 text-white shadow-coral enabled:hover:bg-coral-700'
      : 'border border-line-strong bg-surface text-ink enabled:hover:border-teal-300 enabled:hover:text-teal-700'
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled || isBusy}
      aria-busy={isBusy || undefined}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-(--radius-control) px-4 text-[0.9rem] font-bold transition duration-200 ease-(--ease-out-expo) enabled:hover:-translate-y-px enabled:active:translate-y-0 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}
    >
      {children}
    </button>
  )
}

/** Small underlined text button for secondary choices inside a panel. */
export function TextButton({
  children,
  onClick,
  tone = 'teal',
}: {
  readonly children: ReactNode
  readonly onClick: () => void
  readonly tone?: 'teal' | 'muted'
}) {
  const color = tone === 'teal' ? 'text-teal-700' : 'text-muted hover:text-ink'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm text-[0.8rem] font-semibold underline-offset-4 hover:underline ${color}`}
    >
      {children}
    </button>
  )
}

type PanelProps = {
  readonly children: ReactNode
  readonly labelledBy: string
  /** 'menu' is the wide start screen, which lays out its own padding. */
  readonly size?: 'default' | 'menu'
}

const PANEL_SIZES = {
  default: 'max-w-[360px] px-4 py-5 text-center sm:px-6',
  // Top-align on phones so the action stays above the fold; cap the menu at the board height.
  menu: 'flex max-h-full max-w-[760px] flex-col text-left max-[559px]:my-0 max-[559px]:self-start',
} as const

export function Panel({ children, labelledBy, size = 'default' }: PanelProps) {
  return (
    // `m-auto` instead of grid centring: a panel taller than the board stays scrollable from its top.
    <div className="absolute inset-0 z-20 flex overflow-y-auto bg-page/60 p-3 backdrop-blur-[2px]">
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby={labelledBy}
        className={`@container card m-auto w-full animate-rise shadow-lift ${PANEL_SIZES[size]}`}
      >
        {children}
      </section>
    </div>
  )
}

export function Eyebrow({ children }: { readonly children: ReactNode }) {
  return <p className="text-[0.64rem] font-bold tracking-[0.14em] text-teal-700 uppercase">{children}</p>
}

/** A short note under the panel's actions, e.g. why a run is not ranked. */
export function Note({ children, tone = 'muted' }: { readonly children: ReactNode; readonly tone?: 'muted' | 'alert' }) {
  const color = tone === 'alert' ? 'bg-coral-400/10 text-danger' : 'bg-page text-muted'
  return <p className={`mt-3 rounded-[10px] px-3 py-2 text-[0.78rem] leading-snug ${color}`}>{children}</p>
}

export function Spinner({ className = 'size-4' }: { readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none ${className}`}
    />
  )
}
