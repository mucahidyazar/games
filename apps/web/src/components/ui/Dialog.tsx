import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseIcon } from '@/components/icons'

type DialogProps = {
  readonly isOpen: boolean
  readonly title: string
  readonly description?: string
  readonly onClose: () => void
  readonly children: ReactNode
}

/**
 * Modal built on the native <dialog>: focus trapping, Esc to close and the
 * inert background come from the browser. Clicking the backdrop also closes it.
 */
export function Dialog({ isOpen, title, description, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-auto max-h-[min(86svh,720px)] w-[min(600px,calc(100vw-24px))] overflow-hidden rounded-[16px] border border-line bg-surface p-0 text-ink shadow-lift open:animate-pop"
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start gap-4 border-b border-divider px-5 pt-5 pb-3.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[1.15rem] font-extrabold tracking-[-0.02em]">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-[0.82rem] text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-icon transition hover:bg-page hover:text-ink"
          >
            <CloseIcon className="size-[18px]" />
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">{children}</div>
      </div>
    </dialog>
  )
}
