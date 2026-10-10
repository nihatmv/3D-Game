import { useEffect } from 'react'
import { isTourActive, useStoryStore } from '../store/useStoryStore'
import { beginGesture, isStepping, jumpToStop, scrollBy, stepBy } from './scroll'
import { STOPS, stopForBuilt } from './timeline'

/** A pause in the wheel this long ends a gesture; anything sooner is the same one (a trackpad flick keeps rolling). */
const QUIET_MS = 150
/** Pixels per line, for wheels that report lines. */
const LINE_PX = 40
/** A finger must travel this far before it scrolls the story (a tap stays a tap). */
const DRAG_SLOP = 8

/** `el` or something around it can still scroll its own content up (dy < 0) or down (dy > 0): the gesture belongs to it. */
function scrollsInside(el: EventTarget | null, dy: number): boolean {
  for (let n = el instanceof Element ? el : null; n && n !== document.body; n = n.parentElement) {
    if (n.scrollHeight <= n.clientHeight + 1) continue
    const overflow = getComputedStyle(n).overflowY
    if (overflow !== 'auto' && overflow !== 'scroll') continue
    if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true
  }
  return false
}

const typingIn = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName))

/**
 * Lets the visitor scroll the story (scroll.ts): the wheel, the trackpad and a
 * dragging finger move it by the distance they travel, and one gesture stops
 * at the next building's card however hard the flick (what is left of the
 * flick is swallowed there; the next gesture goes on). Arrow keys, Space and
 * Page keys play a whole step. Only during the tour: in free play the wheel and
 * fingers belong to the camera and tools.
 */
export function useStepInput() {
  const touring = useStoryStore((s) => isTourActive(s))

  // A returning visitor picks up at the last stop they built.
  useEffect(() => {
    jumpToStop(stopForBuilt(useStoryStore.getState().questIndex))
  }, [])

  useEffect(() => {
    if (!touring) return

    let lastWheel = -Infinity
    const onWheel = (e: WheelEvent) => {
      // Pinch-zoom, and cards with more to read, keep their gesture.
      if (e.ctrlKey || scrollsInside(e.target, e.deltaY)) return
      e.preventDefault()
      // When the event happened, not when it got handled: a busy frame must not read as a pause in the gesture.
      const fresh = e.timeStamp - lastWheel > QUIET_MS
      lastWheel = e.timeStamp
      if (isStepping()) return
      if (fresh) beginGesture()
      scrollBy(e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? e.deltaY : e.deltaY * LINE_PX)
    }

    // A finger drags the story along; one touch is one gesture.
    let touch: { y: number; from: EventTarget | null; dragging: boolean } | null = null
    const onTouchStart = (e: TouchEvent) => {
      touch = e.touches.length === 1 ? { y: e.touches[0].clientY, from: e.target, dragging: false } : null
      if (touch && !isStepping()) beginGesture()
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!touch) return
      const y = e.touches[0].clientY
      const dy = y - touch.y
      if (!touch.dragging) {
        if (Math.abs(dy) < DRAG_SLOP || scrollsInside(touch.from, -dy)) return
        touch.dragging = true
      }
      touch.y = y
      // Finger up = on with the story.
      scrollBy(-dy)
    }
    const onTouchEnd = () => (touch = null)

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typingIn(e.target)) return
      const dir =
        e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)
          ? 1
          : e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)
            ? -1
            : 0
      if (dir) stepBy(dir)
      else if (e.key === 'Home') jumpToStop(0)
      else if (e.key === 'End') jumpToStop(STOPS.length - 1)
      else return
      e.preventDefault()
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('keydown', onKey)
    }
  }, [touring])
}
