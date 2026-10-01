import { useEffect } from 'react'
import { useIslandStore } from '../store/useIslandStore'
import { selectActiveQuest, useStoryStore } from '../store/useStoryStore'

/**
 * Checks the active quest's condition after every island edit (and whenever a
 * new quest becomes active). Never runs per frame.
 */
export function useQuestWatcher() {
  useEffect(() => {
    const check = () => {
      const story = useStoryStore.getState()
      const q = selectActiveQuest(story)
      if (q && q.condition(useIslandStore.getState(), q.area)) story.completeQuest(q.id)
    }

    const unsubIsland = useIslandStore.subscribe((s, prev) => {
      if (
        s.terrainVersion !== prev.terrainVersion ||
        s.stoneVersion !== prev.stoneVersion ||
        s.plantVersion !== prev.plantVersion
      )
        check()
    })
    const unsubStory = useStoryStore.subscribe((s, prev) => {
      if (s.questIndex !== prev.questIndex || s.phase !== prev.phase || s.lastDone !== prev.lastDone) check()
    })
    return () => {
      unsubIsland()
      unsubStory()
    }
  }, [])
}
