import { Vector3 } from 'three'
import { applyTool } from '../scene/applyTool'
import { wake } from '../scene/perf'
import { useIslandStore } from '../store/useIslandStore'
import { selectActiveQuest, useStoryStore } from '../store/useStoryStore'
import { HALF, surfaceY } from '../world/constants'
import { idx } from '../world/grid'
import type { Quest } from './quests'

/** Gap between the scripted clicks, so each stone or splash reads on its own. */
const STEP_MS = 200

const isActive = (q: Quest) => selectActiveQuest(useStoryStore.getState())?.id === q.id

/**
 * One click on the glowing target: plays the quest's `clicks` with its tool,
 * as if the visitor had done the whole task by hand. The quest watcher usually
 * completes the quest along the way; if randomness (seeds) falls short, it is
 * completed at the end anyway.
 */
export function runQuestBuild(q: Quest) {
  const story = useStoryStore.getState()
  if (story.building || !isActive(q)) return
  story.setBuilding(true)

  q.clicks.forEach(([dx, dz], k) => {
    setTimeout(() => {
      if (!isActive(q)) return
      const x = q.area.x + dx
      const z = q.area.z + dz
      const { height, type } = useIslandStore.getState()
      const i = idx(x, z)
      const point = new Vector3(x - HALF + 0.5, surfaceY(height[i], type[i]), z - HALF + 0.5)
      applyTool(q.tool, { x, z }, false, point, true)
      wake(600)
    }, k * (q.stepMs ?? STEP_MS))
  })

  setTimeout(() => {
    if (isActive(q)) useStoryStore.getState().completeQuest(q.id)
  }, q.clicks.length * (q.stepMs ?? STEP_MS) + 150)
}
