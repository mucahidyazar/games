import { useEffect, useEffectEvent } from 'react'
import type { GameController } from '../controller/GameController'

type GameShortcutsOptions = {
  readonly controller: GameController
  readonly isEnabled: boolean
  readonly onToggleSound: () => void
}

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/** Page-wide shortcuts: P / Esc pause, M toggles sound. Board-only keys live on the board. */
export function useGameShortcuts({ controller, isEnabled, onToggleSound }: GameShortcutsOptions): void {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!isEnabled || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    if (isTypingTarget(event.target)) return

    switch (event.key.toLowerCase()) {
      case 'p':
        controller.togglePause()
        break
      case 'escape':
        controller.pause()
        break
      case 'm':
        onToggleSound()
        break
      default:
        return
    }
    event.preventDefault()
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent): void => handleKeyDown(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}
