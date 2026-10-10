import { useEffect } from 'react'
import { PIER_DECK_Y, PIER_LENGTH } from '../scene/story/landmarkGeometry'
import { wake } from '../scene/perf'
import { useStoryStore } from '../store/useStoryStore'
import { HALF } from '../world/constants'
import { crewWander, crewWork, gatherCrew, landCrew, sendCrewTo, type Obstacle } from './crew'
import { findPier, type Placement } from './landmarks'
import { QUESTS, TOUR } from './quests'

/** Top of the pier's planks above its placement. */
const DECK_TOP = PIER_DECK_Y + 0.035
/** How far outside a quest's glowing ring the men stand. */
const STAND_OFF = 0.9

const GATHERED = '(gathered)'
/** The row in front of the cabin, from its placement: where it starts, how far in front, the gap, and each mate's slot. */
const ROW_X = -2.8
const ROW_Z = 1.15
const ROW_GAP = 0.62
const ROW = [3, 0, 1, 2, 4, 5]

/** How wide a berth the strolling crew gives each landmark (world units around its placement). */
const BERTH: Partial<Record<string, number>> = { lighthouse: 0.9, bigTree: 1.8, cabin: 1.5, falls: 2 }

const obstacles = (placed: Record<string, Placement>): Obstacle[] =>
  QUESTS.flatMap((q) => {
    const at = placed[q.id]
    const r = BERTH[q.landmark]
    return at && r ? [[at.x, at.z, r] as const] : []
  })

/**
 * Moves the crew with the story: they step off when the ship is tied up, and
 * from then on run to whichever tour stop the scroll is on, hammering there
 * through its build stretch. Past the last stop they line up in front of the
 * cabin for the sunset, and once the story is done they stroll around the
 * island on their own.
 * Runs on store changes only; the walking itself is stepped in scene/story/Crew.tsx.
 */
export function useCrewDirector() {
  useEffect(() => {
    let landed = false
    let site: string | null = null
    let strolling = false
    let working = false
    const step = () => {
      const s = useStoryStore.getState()
      // A returning visitor's island is finished from the first frame: the crew is already at the cabin.
      const back = !landed && s.phase === 'done'
      if (!landed) {
        const pier = findPier(s.placed, QUESTS)
        if ((s.shipState !== 'docked' && !back) || !pier) return
        landed = true
        landCrew(pier, pier.y + DECK_TOP, PIER_LENGTH)
        wake(400)
      }
      if (s.phase === 'ending' || s.phase === 'done' || s.beat.part === 'gather' || s.beat.part === 'sunset') {
        const cabin = QUESTS.find((q) => q.landmark === 'cabin')
        const at = cabin && s.placed[cabin.id]
        if (!at) return
        if (site !== GATHERED) {
          site = GATHERED
          working = false
          // A row along the cabin's front, the captain in the middle and a step forward, all facing the default camera.
          gatherCrew(
            ROW.map((slot, k) => [at.x + ROW_X + slot * ROW_GAP, at.z + ROW_Z + (k === 0 ? 0.2 : 0)] as const),
            Math.PI / 4,
            back,
          )
          wake(400)
        }
        if (s.phase === 'done' && !strolling) {
          strolling = true
          crewWander(obstacles(s.placed))
        }
        return
      }
      const q = TOUR[s.beat.stop]
      if (q && q.id !== site) {
        const cheer = site !== null
        site = q.id
        working = false
        sendCrewTo(q.area.x - HALF + 0.5, q.area.z - HALF + 0.5, q.area.r + STAND_OFF, cheer)
        wake(400)
      }
      if (q && working !== (s.beat.part === 'build')) {
        working = !working
        crewWork(working)
        wake(400)
      }
    }
    step()
    return useStoryStore.subscribe(step)
  }, [])
}
