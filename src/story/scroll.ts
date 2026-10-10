import { wake } from '../scene/perf'

/**
 * How far down the page the visitor has scrolled, as story progress (0..1; see
 * timeline.ts). `target` is where the page is, `value` eases after it so wheel
 * steps read as motion. Plain mutable state: the scene reads `value` in its
 * frame loop (ScrollDriver steps it), so scrolling costs no React renders, and
 * nothing runs while the page is still.
 */
export const scroll = { target: 0, value: 0 }

/** How fast `value` catches up with the page (per second). */
const FOLLOW = 9
const SETTLED = 0.0002

const range = () => document.documentElement.scrollHeight - window.innerHeight

function read() {
  const max = range()
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
}

/** Follow the page's scroll position. Returns the cleanup. */
export function watchScroll(): () => void {
  const onScroll = () => {
    scroll.target = read()
    wake(300)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => window.removeEventListener('scroll', onScroll)
}

/** Put the page at story progress `value` at once, with no easing. */
export function jumpScroll(value: number) {
  window.scrollTo(0, value * Math.max(0, range()))
  scroll.target = scroll.value = read()
  wake(300)
}

/** Ease `value` toward the page by `dt` seconds. Returns true while it is still catching up. */
export function stepScroll(dt: number): boolean {
  const diff = scroll.target - scroll.value
  if (diff === 0) return false
  if (Math.abs(diff) < SETTLED) {
    scroll.value = scroll.target
    return false
  }
  scroll.value += diff * (1 - Math.exp(-FOLLOW * dt))
  return true
}
