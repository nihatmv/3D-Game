import { useEffect } from 'react'
import { useStoryStore } from '../store/useStoryStore'

/** How long the captain's greeting stays before the first task appears. */
export const INTRO_MS = 3500
/** Camera flight to a landmark and back (CameraRig). */
export const FLY_MS = 1000

/**
 * Keeps the tour moving without "Next" buttons: the intro starts the first
 * task once the ship is anchored. After a landmark, its card's Continue
 * (closeCard) flies the camera home, then the next task appears.
 * Runs on store changes only (timers, never per frame).
 */
export function useTourDirector() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending: string | null = null

    const schedule = (key: string | null, ms: number, run: () => void) => {
      if (key === pending) return
      clearTimeout(timer)
      pending = key
      if (key) timer = setTimeout(() => ((pending = null), run()), ms)
    }

    const step = () => {
      const s = useStoryStore.getState()
      if (s.phase === 'intro' && s.shipState === 'waiting') schedule('intro', INTRO_MS, s.startQuests)
      else if (s.lastDone && !s.openCard) schedule(`done-${s.lastDone}`, FLY_MS, s.clearLastDone)
      else schedule(null, 0, () => {})
    }
    step()
    const unsub = useStoryStore.subscribe(step)
    return () => {
      unsub()
      clearTimeout(timer)
    }
  }, [])
}
