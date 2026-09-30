import { useEffect, useRef } from 'react'

/**
 * Moves focus to the returned element when a panel appears mid-game (pause,
 * level clear, game over), so keyboard and screen-reader users land on the
 * next action. `preventScroll` keeps the board steady.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}
