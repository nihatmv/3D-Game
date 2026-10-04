import { useEffect } from 'react'
import { selectActiveQuest, useStoryStore } from '../store/useStoryStore'
import { runQuestBuild } from './questBuild'

/** How long the captain's greeting stays before the first task appears. */
export const INTRO_MS = 7000
/** Camera flight to a landmark and back (CameraRig). */
export const FLY_MS = 1000
/** "Build it all": how long each card stays open (it fades in once the camera lands, so ~1.7s readable). */
const AUTO_CARD_MS = 2600
/** "Build it all": pause before each stop's build, and how much faster its clicks play. */
const AUTO_START_MS = 250
const AUTO_SPEED = 1.5

/**
 * Keeps the tour moving without "Next" buttons: the intro starts the first
 * task once the ship has landed. After a landmark, its card's Continue
 * (closeCard) flies the camera home, then the next task appears.
 * In "Build it all" (`autoBuild`) it also starts each stop's build and
 * closes each card by itself, so the remaining stops play one by one.
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
      const auto = s.autoBuild ? selectActiveQuest(s) : null
      if (s.autoBuild && s.phase === 'intro') schedule('auto-intro', 0, s.startQuests)
      else if (s.autoBuild && s.lastDone && s.openCard) schedule(`auto-card-${s.lastDone}`, AUTO_CARD_MS, s.closeCard)
      else if (auto && !s.building) schedule(`auto-build-${auto.id}`, AUTO_START_MS, () => runQuestBuild(auto, AUTO_SPEED))
      else if (s.phase === 'intro' && s.shipState === 'docked') schedule('intro', INTRO_MS, s.startQuests)
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
