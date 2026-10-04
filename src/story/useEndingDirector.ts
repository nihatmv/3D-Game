import { useEffect } from 'react'
import { useStoryStore } from '../store/useStoryStore'
import { crewParty } from './crew'

/** How long the sunset plays over the finished island before the contact card opens. */
const SUNSET_MS = 3800

/**
 * Runs the ending once every landmark is built (played or skipped) and the
 * last card is closed: the camera flies to the cabin, where the crew has lined
 * up (useCrewDirector) and now celebrates as the sun goes down; then the story
 * is done and the contact card opens.
 */
export function useEndingDirector() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const step = () => {
      const s = useStoryStore.getState()
      if (timer || s.phase !== 'ending' || s.openCard || s.shipState !== 'docked') return
      // Timer first: startSunset changes the store, which runs this again.
      timer = setTimeout(s.finishStory, SUNSET_MS)
      crewParty(SUNSET_MS / 1000)
      s.startSunset()
    }
    step()
    const unsub = useStoryStore.subscribe(step)
    return () => {
      unsub()
      clearTimeout(timer)
    }
  }, [])
}
