import { useRef, type CSSProperties, type PointerEvent } from 'react'
import { usePrefersReducedMotion } from '@/lib/motion'

/** Degrees the card leans towards the pointer at the edges. */
const MAX_TILT_DEG = 7

export interface Tilt {
  /** Spread onto the element that should lean. */
  readonly props: {
    readonly style: CSSProperties
    readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void
    readonly onPointerLeave: () => void
  }
}

/**
 * A card that leans towards the pointer, with a highlight that follows it.
 * Only transforms and custom properties change, so the browser composites
 * the motion; nothing moves for visitors who prefer reduced motion or on
 * touch screens (there is no hover to follow).
 */
export function useTilt(): Tilt {
  const ref = useRef<HTMLElement | null>(null)
  const isReduced = usePrefersReducedMotion()

  const reset = (): void => {
    const element = ref.current
    if (!element) return
    element.style.setProperty('--rx', '0deg')
    element.style.setProperty('--ry', '0deg')
    element.style.setProperty('--glow', '0')
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>): void => {
    if (isReduced || event.pointerType !== 'mouse') return
    const element = event.currentTarget
    ref.current = element
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    element.style.setProperty('--rx', `${((0.5 - y) * 2 * MAX_TILT_DEG).toFixed(2)}deg`)
    element.style.setProperty('--ry', `${((x - 0.5) * 2 * MAX_TILT_DEG).toFixed(2)}deg`)
    element.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
    element.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
    element.style.setProperty('--glow', '1')
  }

  return {
    props: {
      style: {
        transform: 'perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))',
        transition: 'transform 220ms ease-out',
      },
      onPointerMove,
      onPointerLeave: reset,
    },
  }
}
