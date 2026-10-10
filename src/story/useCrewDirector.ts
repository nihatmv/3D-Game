import { useEffect } from 'react'
import { PIER_DECK_Y, PIER_LENGTH } from '../scene/story/landmarkGeometry'
import { wake } from '../scene/perf'
import { useStoryStore } from '../store/useStoryStore'
import { crewWander, gatherCrew, setCrewPier, type Obstacle } from './crew'
import { findPier, type Placement } from './landmarks'
import { QUESTS } from './quests'

/** Top of the pier's planks above its placement. */
const DECK_TOP = PIER_DECK_Y + 0.035

/** How wide a berth the strolling crew gives each landmark (world units around its placement). */
const BERTH: Partial<Record<string, number>> = { lighthouse: 0.9, bigTree: 1.8, cabin: 1.5, falls: 2 }

const obstacles = (placed: Record<string, Placement>): Obstacle[] =>
  QUESTS.flatMap((q) => {
    const at = placed[q.id]
    const r = BERTH[q.landmark]
    return at && r ? [[at.x, at.z, r] as const] : []
  })

/**
 * The crew's part outside the scroll: tells them where the pier is, and once
 * free play begins lets them stroll around the island on their own, starting
 * from the row at the cabin. During the tour they follow the
 * scroll (scrubCrew, called from scene/story/Crew.tsx).
 * Runs on store changes only.
 */
export function useCrewDirector() {
  useEffect(() => {
    let docked = false
    let gathered = false
    let strolling = false
    const step = () => {
      const s = useStoryStore.getState()
      const pier = findPier(s.placed, QUESTS)
      if (pier && !docked) {
        docked = true
        setCrewPier(pier, pier.y + DECK_TOP, PIER_LENGTH)
      }
      if (s.phase !== 'done') return
      const cabin = QUESTS.find((q) => q.landmark === 'cabin')
      const at = cabin && s.placed[cabin.id]
      if (!at) return
      if (!gathered) {
        gathered = true
        gatherCrew(at)
        wake(400)
      }
      if (!strolling) {
        strolling = true
        crewWander(obstacles(s.placed))
      }
    }
    step()
    return useStoryStore.subscribe(step)
  }, [])
}
