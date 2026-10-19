import { useEffect, useRef, useState } from 'react'
import { drawPixelText, type Layout, type PixelTextStyle } from './drawPixelText'

/**
 * Text drawn the way the key frame's titles and buttons are: a bold rounded
 * face rendered a few pixels tall, without anti-aliasing, then blown up
 * into crisp squares. The real text stays in the DOM for assistive tech.
 */

type PixelTextProps = PixelTextStyle & {
  /** Wrap to the parent's width minus this many CSS pixels (titles flanked by sparkles). */
  readonly parentReserve?: number
  readonly className?: string
}

export function PixelText(props: PixelTextProps) {
  const { text, className = '' } = props
  const wrapRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [layout, setLayout] = useState<Layout | null>(null)
  const [fontsReady, setFontsReady] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const element = wrapRef.current
    if (!element) return
    const measure = (): void => {
      const style = getComputedStyle(element)
      const fontSize = parseFloat(style.fontSize) || 16
      const dpr = window.devicePixelRatio || 1
      const scale = Math.max(1, Math.round((fontSize * dpr) / props.artSize))
      const available = props.parentReserve !== undefined && element.parentElement ? element.parentElement.clientWidth - props.parentReserve : element.clientWidth || element.parentElement?.clientWidth || 600
      const maxWidth = Math.floor((Math.max(80, available) * dpr) / scale)
      setLayout((current) => (current && current.scale === scale && current.maxWidth === maxWidth ? current : { scale, maxWidth }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element.parentElement ?? element)
    return () => observer.disconnect()
  }, [props.artSize, props.parentReserve])

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return
    let cancelled = false
    void document.fonts.load(`${props.weight ?? 700} ${props.artSize}px ${props.family}`, text).then(() => {
      if (!cancelled) setFontsReady((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [props.family, props.weight, props.artSize, text])

  const { family, weight, artSize, fill, outline, shadow, trim, align, letterSpacing, singleLine } = props
  const fillKey = typeof fill === 'string' ? fill : fill.join(',')
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !layout) return
    let size: ReturnType<typeof drawPixelText> = null
    try {
      size = drawPixelText(canvas, { text, family, weight, artSize, fill: fillKey.split(','), outline, shadow, trim, align, letterSpacing, singleLine }, layout)
    } catch {
      size = null
    }
    setFailed(size === null)
    if (!size) return
    const dpr = window.devicePixelRatio || 1
    canvas.style.width = `${(size.width * layout.scale) / dpr}px`
    canvas.style.height = `${(size.height * layout.scale) / dpr}px`
  }, [layout, fontsReady, text, family, weight, artSize, fillKey, outline, shadow, trim, align, letterSpacing, singleLine])

  return (
    <span ref={wrapRef} className={`atp-pixel-text ${failed ? 'is-fallback' : ''} ${className}`}>
      <span className={failed ? 'atp-pixel-fallback' : 'sr-only'}>{text}</span>
      <canvas ref={canvasRef} aria-hidden="true" className="atp-pixel-canvas" hidden={failed} />
    </span>
  )
}
