import { Vector3 } from 'three'
import { applyTool } from '../scene/applyTool'
import { wake } from '../scene/perf'
import { emit } from '../scene/puffs'
import { useIslandStore } from '../store/useIslandStore'
import { selectActiveQuest, useStoryStore } from '../store/useStoryStore'
import { HALF, surfaceY } from '../world/constants'
import { idx } from '../world/grid'
import { crewReady, crewWork } from './crew'
import type { Quest } from './quests'

/** Gap between the scripted clicks, so each stone or splash reads on its own. */
const STEP_MS = 200
/** The least time the crew hammers before the landmark rises. */
const HAMMER_MS = 1100
/** How long a click waits for the crew to reach the site ("Build it all" can outrun them). */
const CREW_WAIT_MS = 1400
/** Men at the site that are enough to start. */
const CREW_ENOUGH = 3

const isActive = (q: Quest) => selectActiveQuest(useStoryStore.getState())?.id === q.id

/**
 * One click on the glowing target: the crew hammers at the site while the
 * quest's `clicks` play with its tool, as if the visitor had done the whole
 * task by hand. The quest watcher usually completes the quest along the way;
 * otherwise (scenery stops, or seeds falling short) it is completed at the end.
 * `speed` > 1 plays it faster ("Build it all").
 */
export function runQuestBuild(q: Quest, speed = 1) {
  const story = useStoryStore.getState()
  if (story.building || !isActive(q)) return
  story.setBuilding(true)
  const step = (q.stepMs ?? STEP_MS) / speed
  const hammer = HAMMER_MS / speed
  // The clicks land in the second half of the hammering, so the landmark rises as they finish.
  const lead = Math.max(0, hammer - q.clicks.length * step - 150)
  const cx = q.area.x - HALF + 0.5
  const cz = q.area.z - HALF + 0.5

  const build = () => {
    if (!isActive(q)) return
    crewWork(true)
    wake(hammer + 300)
    const { height, type } = useIslandStore.getState()
    const ci = idx(q.area.x, q.area.z)
    const cy = surfaceY(height[ci], type[ci])
    for (let t = 150; t < hammer; t += 320) {
      setTimeout(() => isActive(q) && emit('dust', cx, cy + 0.15, cz, 5), t)
    }

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
      }, lead + k * step)
    })

    setTimeout(() => {
      if (isActive(q)) useStoryStore.getState().completeQuest(q.id)
    }, lead + q.clicks.length * step + 150)
  }

  // Start once enough of the crew stands at the site (they are usually there already).
  const waitUntil = performance.now() + CREW_WAIT_MS / speed
  const poll = () => {
    if (crewReady() >= CREW_ENOUGH || performance.now() >= waitUntil) build()
    else setTimeout(poll, 100)
  }
  poll()
}
