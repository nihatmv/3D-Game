import { useEffect } from 'react'
import { isTourActive, useStoryStore } from '../store/useStoryStore'
import { isStepping, jumpToStop, stepBy } from './scroll'
import { STOPS, stopForBuilt } from './timeline'

/** A pause in the wheel this long ends a gesture (a trackpad flick keeps rolling until then). */
const QUIET_MS = 150
/** Pixels per line, for wheels that report lines. */
const LINE_PX = 40
/** Wheel travel a gesture needs before it plays a step (a brush of the trackpad does nothing). */
const WHEEL_STEP_PX = 24
/**
 * Within a gesture, a delta this many times the last one is a new push, not
 * the fading inertia of a flick: a visitor swiping again while a flick still
 * rolls gets their step without waiting for it to die out.
 */
const PUSH = 2
const PUSH_MIN_PX = 12
/** A finger must travel this far to play a step (a tap stays a tap). */
const SWIPE_PX = 30

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
 * Lets the visitor play the story (scroll.ts): one gesture (a turn of the
 * wheel, a trackpad swipe however hard, a finger's swipe) plays one step, on
 * to the next building or back, and the story builds it at its own pace. A
 * gesture that starts while a step plays is ignored, as is whatever is left of
 * one once its step has played. Arrow keys, Space and Page keys play a step too.
 * Only during the tour: in free play the wheel and fingers belong to the camera
 * and tools.
 */
export function useStepInput() {
  const touring = useStoryStore((s) => isTourActive(s))

  // A returning visitor picks up at the last stop they built.
  useEffect(() => {
    jumpToStop(stopForBuilt(useStoryStore.getState().questIndex))
  }, [])

  useEffect(() => {
    if (!touring) return

    // The wheel gesture in hand: how far it has gone, its last delta, and whether it has had its say.
    let wheel = { at: -Infinity, travel: 0, last: 0, spent: false }
    const onWheel = (e: WheelEvent) => {
      // Pinch-zoom, and cards with more to read, keep their gesture.
      if (e.ctrlKey || scrollsInside(e.target, e.deltaY)) return
      e.preventDefault()
      const dy = e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? e.deltaY : e.deltaY * LINE_PX
      const size = Math.abs(dy)
      // Timed by when the event happened, not when it got handled: a busy frame is not a pause.
      const pause = e.timeStamp - wheel.at > QUIET_MS
      const push = size >= PUSH_MIN_PX && size >= wheel.last * PUSH
      if (pause || (push && wheel.spent && !isStepping())) wheel = { at: 0, travel: 0, last: 0, spent: false }
      wheel.at = e.timeStamp
      wheel.last = size
      if (wheel.spent) return
      wheel.travel += dy
      if (Math.abs(wheel.travel) < WHEEL_STEP_PX) return
      // Spent either way: a gesture made while a step plays doesn't wait to play after it.
      wheel.spent = true
      if (!isStepping()) stepBy(wheel.travel > 0 ? 1 : -1)
    }

    // A finger's swipe plays a step; one touch is one gesture.
    let touch: { y: number; from: EventTarget | null; spent: boolean } | null = null
    const onTouchStart = (e: TouchEvent) => {
      touch = e.touches.length === 1 ? { y: e.touches[0].clientY, from: e.target, spent: false } : null
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!touch || touch.spent) return
      const dy = e.touches[0].clientY - touch.y
      if (Math.abs(dy) < SWIPE_PX || scrollsInside(touch.from, -dy)) return
      touch.spent = true
      // Finger up = on with the story.
      if (!isStepping()) stepBy(dy < 0 ? 1 : -1)
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
