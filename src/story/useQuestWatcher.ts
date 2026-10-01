import { useEffect } from 'react'
import { useIslandStore } from '../store/useIslandStore'
import { selectActiveQuest, selectToolLock, useStoryStore } from '../store/useStoryStore'

/**
 * Checks the active quest's condition after every island edit (and whenever a
 * new quest becomes active). Never runs per frame. Also keeps the island's
 * tool pinned to the current quest's tool (see selectToolLock).
 */
export function useQuestWatcher() {
  useEffect(() => {
    const check = () => {
      const story = useStoryStore.getState()
      const q = selectActiveQuest(story)
      if (q && q.condition(useIslandStore.getState(), q.area)) story.completeQuest(q.id)
    }

    // Any other tool is switched straight back, whoever set it (buttons, hotkeys, console).
    const pinTool = () => {
      const lock = selectToolLock(useStoryStore.getState())
      const island = useIslandStore.getState()
      if (lock && island.tool !== lock) island.setTool(lock)
    }
    pinTool()

    const unsubIsland = useIslandStore.subscribe((s, prev) => {
      if (s.tool !== prev.tool) pinTool()
      if (
        s.terrainVersion !== prev.terrainVersion ||
        s.stoneVersion !== prev.stoneVersion ||
        s.plantVersion !== prev.plantVersion
      )
        check()
    })
    const unsubStory = useStoryStore.subscribe((s, prev) => {
      if (s.questIndex !== prev.questIndex || s.phase !== prev.phase) pinTool()
      if (s.questIndex !== prev.questIndex || s.phase !== prev.phase || s.lastDone !== prev.lastDone) check()
    })
    return () => {
      unsubIsland()
      unsubStory()
    }
  }, [])
}
