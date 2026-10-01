import { useEffect } from 'react'
import { useStoryStore } from '../store/useStoryStore'

/**
 * Runs the ending once every landmark is built (played or skipped): when the
 * captain has finished talking and the ship is at anchor, it docks; once it
 * is tied up, the story is done and the contact card opens.
 */
export function useEndingDirector() {
  useEffect(() => {
    const step = () => {
      const s = useStoryStore.getState()
      if (s.phase !== 'ending') return
      if (!s.lastDone && s.shipState === 'waiting') s.startDocking()
      else if (s.shipState === 'docked') s.finishStory()
    }
    step()
    return useStoryStore.subscribe(step)
  }, [])
}
