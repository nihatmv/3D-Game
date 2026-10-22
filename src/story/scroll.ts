import { wake } from '../scene/perf'
import { useStoryStore } from '../store/useStoryStore'
import { STOPS, secondsBetween } from './timeline'

/**
 * Story progress (0..1; see timeline.ts) and what moves it. The story plays
 * itself: one scroll gesture, key or on-screen hint (useStepInput) plays it on
 * to the next of STOPS (a building with its card up) or back to the one
 * before, at the story's own pace (stepBy). More scrolling while a step plays
 * neither hurries it nor queues another; the next gesture after it lands plays
 * the next step. The page itself never scrolls. Plain mutable state: the scene
 * reads `value` in its frame loop (ScrollDriver steps it), so none of this
 * costs React renders, and nothing runs while the story rests.
 */
export const scroll = { value: 0 }

/** Closer to a stop than this counts as being at it. */
const AT = 0.0005

/** A step being played. */
let move: { from: number; to: number; at: number; seconds: number } | null = null

const nextStop = (from: number) => STOPS.find((s) => s > from + AT) ?? 1
const prevStop = (from: number) => [...STOPS].reverse().find((s) => s < from - AT) ?? 0

/** Tell the UI which stop the story has reached (0 only at the very top). */
function report() {
  const reached = STOPS.filter((s) => s <= scroll.value + AT).length - 1
  useStoryStore.getState().setStep(scroll.value > AT ? Math.max(1, reached) : 0)
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** A step is being played: input waits until it lands. */
export const isStepping = () => move !== null

/** Show stop `i` at once (the HUD's dots and Skip, a returning visitor). Whatever lies between is built on the way. */
export function jumpToStop(i: number) {
  move = null
  scroll.value = STOPS[Math.min(STOPS.length - 1, Math.max(0, i))]
  report()
  wake(300)
}

/**
 * Play the story on to the next stop (1) or back to the one before (-1) at its
 * own pace. Returns false, and does nothing, while a step is playing or at
 * either end.
 */
export function stepBy(dir: 1 | -1): boolean {
  if (move) return false
  const to = dir > 0 ? nextStop(scroll.value) : prevStop(scroll.value)
  if (Math.abs(to - scroll.value) <= AT) return false
  if (reducedMotion()) {
    jumpToStop(STOPS.indexOf(to))
    return true
  }
  move = { from: scroll.value, to, at: 0, seconds: secondsBetween(scroll.value, to) }
  wake(300)
  return true
}

/** Share of a step spent getting up to speed, and again slowing into the stop. */
const RAMP = 0.16

/** Steady pace with a soft start and a soft landing: 0..1 -> 0..1. */
function pace(k: number) {
  const top = 1 / (1 - RAMP)
  if (k < RAMP) return (top * k * k) / (2 * RAMP)
  if (k > 1 - RAMP) return 1 - (top * (1 - k) * (1 - k)) / (2 * RAMP)
  return top * (k - RAMP / 2)
}

/** Move the step being played on by `dt` seconds. Returns true while it is still moving. */
export function stepScroll(dt: number): boolean {
  if (!move) return false
  move.at += dt
  const k = Math.min(1, move.at / move.seconds)
  scroll.value = k < 1 ? move.from + (move.to - move.from) * pace(k) : move.to
  if (k >= 1) move = null
  report()
  return move !== null
}

// Dev-only handle for debugging and headless tests.
if (import.meta.env.DEV) (window as unknown as { tour: object }).tour = { scroll, stepBy, jumpToStop, isStepping, STOPS }
