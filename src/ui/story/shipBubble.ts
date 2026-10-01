/**
 * Keeps the captain's speech bubble beside the ship on wide screens.
 * The ship reports its screen position every rendered frame (`setShipScreen`);
 * the bubble sits to its left (or under it near the screen edge) and is
 * restyled only when its placement actually changes.
 */

const GAP = 22 // ship anchor to bubble edge (the tail fills it)
const MARGIN = 16
const TOP_SAFE = 72 // below the HUD buttons
const BOTTOM_SAFE = 190 // above the toolbar
const MIN_W = 280
const MAX_W = 430
const BELOW_DROP = 52 // anchor (mid-sails) to below the hull

let el: HTMLElement | null = null
let observer: ResizeObserver | null = null
let w = 0
let h = 0
let sx = 0
let sy = 0
let known = false
let last = ''

/** Ref callback for the bubble's wrapper. */
export function bindShipBubble(node: HTMLElement | null) {
  observer?.disconnect()
  observer = null
  el = node
  last = ''
  if (!node) return
  observer = new ResizeObserver(() => {
    w = node.offsetWidth
    h = node.offsetHeight
    place()
  })
  observer.observe(node)
  w = node.offsetWidth
  h = node.offsetHeight
  place()
}

/** The ship's position in CSS pixels (called from the ship's frame loop). */
export function setShipScreen(x: number, y: number) {
  sx = x
  sy = y
  known = true
  if (el) place()
}

// When the range is empty (tiny window), `lo` wins.
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function place() {
  if (!el || !known || !w) return
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxW = clamp(vw * 0.3, MIN_W, MAX_W)
  const roomLeft = sx - GAP - MARGIN
  let side: 'left' | 'below'
  let width: number
  let x: number
  let y: number
  let tail: number
  if (roomLeft >= MIN_W) {
    // Open sea on the ship's left: narrow the bubble to fit rather than cover the island.
    side = 'left'
    width = Math.min(maxW, roomLeft)
    x = sx - GAP - width
    y = clamp(sy - h * 0.45, TOP_SAFE, vh - BOTTOM_SAFE - h)
    tail = clamp(sy - y, 26, h - 26)
  } else {
    // Ship near the left edge: hang the bubble under it.
    side = 'below'
    width = maxW
    x = clamp(sx - 70, MARGIN, vw - width - MARGIN)
    y = clamp(sy + BELOW_DROP, TOP_SAFE, vh - BOTTOM_SAFE - h)
    tail = clamp(sx - x, 26, width - 26)
  }
  const key = `${side}|${Math.round(width)}|${Math.round(x)}|${Math.round(y)}|${Math.round(tail)}`
  if (key === last) return
  last = key
  el.dataset.side = side
  el.style.width = `${Math.round(width)}px`
  el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
  el.style.setProperty('--tail', `${Math.round(tail)}px`)
}
