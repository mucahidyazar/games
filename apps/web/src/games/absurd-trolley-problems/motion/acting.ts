import { easeInCubic, easeOutBack, easeOutQuad, linear, setAttr, type Timeline } from './animate'
import { FIGURE } from './geometry'

/**
 * What the people in the motion scenes do: look up in alarm, get hit, fall,
 * jump for joy. Each takes a figure's root group (see Figure) and animates
 * the parts inside it on the scene's timeline.
 */

export function part(root: Element | null | undefined, name: string): SVGGElement | null {
  return root?.querySelector<SVGGElement>(`[data-part="${name}"]`) ?? null
}

export function parts(root: Element | null | undefined, name: string): SVGGElement[] {
  return root ? Array.from(root.querySelectorAll<SVGGElement>(`[data-part="${name}"]`)) : []
}

function armTransform(side: -1 | 1, angle: number): string {
  return `translate(${side * FIGURE.shoulderX} ${FIGURE.shoulderY}) rotate(${Math.round(-side * angle * 10) / 10})`
}

/** Raises (or lowers) both arms to `angle` degrees from hanging straight down. */
export function setArms(figure: Element, angle: number): void {
  setAttr(part(figure, 'arm-left'), 'transform', armTransform(-1, angle))
  setAttr(part(figure, 'arm-right'), 'transform', armTransform(1, angle))
}

/** Fades a node in or out. */
export function fade(timeline: Timeline, node: Element | null, to: number, duration = 240): Promise<void> {
  const from = Number(node?.getAttribute('opacity') ?? 1)
  return timeline.tween(duration, (v) => setAttr(node, 'opacity', Math.round((from + (to - from) * v) * 100) / 100), easeOutQuad)
}

/** Pops a sign into view over `base` (its resting translate). */
export function pop(timeline: Timeline, node: Element | null, base: string, duration = 320): Promise<void> {
  return timeline.tween(
    duration,
    (v) => {
      setAttr(node, 'opacity', Math.min(1, v * 3))
      setAttr(node, 'transform', `${base} scale(${Math.round((0.3 + 0.7 * v) * 100) / 100})`)
    },
    easeOutBack,
  )
}

/** Sees it coming: the alarm goes up over their head and their arms fly up. */
export function alarm(timeline: Timeline, figure: Element): void {
  part(figure, 'marker')?.setAttribute('opacity', '0')
  void pop(timeline, part(figure, 'alert'), 'translate(0 -96)', 260)
  void timeline.tween(200, (v) => setArms(figure, FIGURE.armRest + 140 * v), easeOutQuad)
}

function stillAndHidden(figure: Element): void {
  figure.querySelector('.atp-m-idle')?.classList.add('is-still')
  for (const name of ['marker', 'alert']) part(figure, name)?.setAttribute('opacity', '0')
  figure.querySelector('.atp-m-shadow')?.setAttribute('opacity', '0')
}

/** What rises from where someone was lost, at (x, y) in their own frame. */
function release(timeline: Timeline, figure: Element, x: number, y: number): Promise<void> {
  const soul = part(figure, 'soul')
  return timeline.tween(
    1500,
    (v) => {
      setAttr(soul, 'transform', `translate(${Math.round(x + Math.sin(v * 6) * 4)} ${Math.round(y - 74 * v)})`)
      setAttr(soul, 'opacity', Math.round((v < 0.2 ? v * 4.5 : 0.9 * (1 - (v - 0.2) / 0.8)) * 100) / 100)
    },
    easeOutQuad,
  )
}

/** Puts a figure straight into how a run left them: lying in `pose`, dimmed. */
export function lieDown(figure: Element, pose: string): void {
  stillAndHidden(figure)
  const body = part(figure, 'body')
  setAttr(body, 'transform', pose)
  setAttr(body, 'opacity', 0.5)
}

/** Where a knocked figure ends up, lying down, `direction` 1 for knocked to the right, `distance` along. */
export function knockedPose(direction: 1 | -1, drop: number, distance = 128): string {
  return `translate(${distance * direction} ${drop + 34}) rotate(${90 * direction} 0 -40)`
}

/** Hit by the tram: thrown along an arc, tumbling, to lie dimmed by the track while their soul floats off. */
export async function knock(timeline: Timeline, figure: Element, direction: 1 | -1, drop: number, distance = 128): Promise<void> {
  stillAndHidden(figure)
  const body = part(figure, 'body')
  await timeline.tween(
    780,
    (v) => {
      const x = distance * direction * v
      const y = (drop + 34) * v - 112 * 4 * v * (1 - v)
      setAttr(body, 'transform', `translate(${Math.round(x)} ${Math.round(y)}) rotate(${Math.round(450 * direction * v)} 0 -40)`)
    },
    linear,
  )
  setAttr(body, 'transform', knockedPose(direction, drop, distance))
  setAttr(body, 'opacity', 0.5)
  // The alarm may still have been popping up when they were hit.
  stillAndHidden(figure)
  void release(timeline, figure, distance * direction, drop - 6)
}

/** Lost where they stand (behind bars): dimmed, and their soul floats off. */
export async function lose(timeline: Timeline, figure: Element): Promise<void> {
  stillAndHidden(figure)
  await fade(timeline, part(figure, 'body'), 0.5, 400)
  void release(timeline, figure, 0, -50)
}

/** Dimmed where they lie, and nothing more: no soul rises (the operating theatre, which takes no side). */
export async function fadeAway(timeline: Timeline, figure: Element): Promise<void> {
  stillAndHidden(figure)
  await fade(timeline, part(figure, 'body'), 0.5, 700)
}

/** Lost, as a decided dilemma shows it: dimmed where they stand. */
export function lost(figure: Element): void {
  stillAndHidden(figure)
  setAttr(part(figure, 'body'), 'opacity', 0.5)
}

/** Takes the signs off someone's head: it's over, one way or the other. */
export function calm(figure: Element): void {
  for (const name of ['marker', 'alert']) part(figure, name)?.setAttribute('opacity', '0')
}

/** Hurt, not killed: slumped over and dimmed, with no soul rising (Foot's tortured prisoners). */
export async function slump(timeline: Timeline, figure: Element, direction: 1 | -1 = 1): Promise<void> {
  stillAndHidden(figure)
  const body = part(figure, 'body')
  await timeline.tween(
    480,
    (v) => {
      setAttr(body, 'transform', slumpedPose(direction, v))
      setAttr(body, 'opacity', Math.round((1 - 0.45 * v) * 100) / 100)
    },
    easeOutQuad,
  )
  setArms(figure, FIGURE.armRest - 6)
}

/** How a hurt figure is left: bent over, a little lower. */
export function slumpedPose(direction: 1 | -1, amount = 1): string {
  return `translate(0 ${Math.round(8 * amount)}) rotate(${Math.round(24 * direction * amount)} 0 -20)`
}

/** Walks a group from `from` to `to` (x only), bobbing with each step. */
export function walk(timeline: Timeline, node: Element | null, from: number, to: number, y: number, duration: number): Promise<void> {
  return timeline.tween(
    duration,
    (v) => setAttr(node, 'transform', `translate(${Math.round(from + (to - from) * v)} ${Math.round((y - Math.abs(Math.sin(v * Math.PI * 6)) * 3) * 10) / 10})`),
    linear,
  )
}

/** Walks a group from one point to another, bobbing with each step. */
export function walkTo(timeline: Timeline, node: Element | null, from: { readonly x: number; readonly y: number }, to: { readonly x: number; readonly y: number }, duration: number): Promise<void> {
  return timeline.tween(
    duration,
    (v) => {
      const bob = Math.abs(Math.sin(v * Math.PI * 6)) * 3
      setAttr(node, 'transform', `translate(${Math.round(from.x + (to.x - from.x) * v)} ${Math.round((from.y + (to.y - from.y) * v - bob) * 10) / 10})`)
    },
    linear,
  )
}

/** Left, right, left…: which way the `index`th of a row falls, starting with `first`. */
export const alternate = (first: 1 | -1, index: number): 1 | -1 => (index % 2 === 0 ? first : first === 1 ? -1 : 1)

/** Where a fallen figure ends up. */
export function fallenPose(direction: 1 | -1): string {
  return `rotate(${90 * direction})`
}

/** Falls where they stand. */
export async function fall(timeline: Timeline, figure: Element, direction: 1 | -1): Promise<void> {
  stillAndHidden(figure)
  const body = part(figure, 'body')
  await timeline.tween(520, (v) => setAttr(body, 'transform', `rotate(${Math.round(90 * direction * v)})`), easeInCubic)
  setAttr(body, 'opacity', 0.5)
  void release(timeline, figure, 34 * direction, -6)
}

/** Jumps for joy, twice, arms in the air. */
export async function cheer(timeline: Timeline, figure: Element): Promise<void> {
  for (const name of ['marker', 'alert']) part(figure, name)?.setAttribute('opacity', '0')
  const body = part(figure, 'body')
  await timeline.tween(
    1000,
    (v) => {
      setAttr(body, 'transform', `translate(0 ${Math.round(-20 * Math.abs(Math.sin(v * Math.PI * 2)))})`)
      setArms(figure, v < 0.85 ? 160 : FIGURE.armRest + (160 - FIGURE.armRest) * (1 - (v - 0.85) / 0.15))
    },
    linear,
  )
}

/** A short, fading judder of the whole scene. */
export function shake(timeline: Timeline, camera: Element | null, strength = 7): Promise<void> {
  return timeline.tween(
    300,
    (v) => {
      const fall = (1 - v) * strength
      setAttr(camera, 'transform', `translate(${Math.round(Math.sin(v * 47) * fall * 10) / 10} ${Math.round(Math.cos(v * 39) * fall * 6) / 10})`)
    },
    linear,
  )
}
