import { Vector3 } from 'three'
import { applyTool } from '../scene/applyTool'
import { wake } from '../scene/perf'
import { useIslandStore } from '../store/useIslandStore'
import { isTourActive, useStoryStore } from '../store/useStoryStore'
import { track } from '../analytics'
import { HALF, surfaceY } from '../world/constants'
import { idx } from '../world/grid'
import { crewParty } from './crew'
import { TOUR, type LandmarkKind, type Quest } from './quests'
import { scroll } from './scroll'
import { PLACE_AT, beatAt, clicksDue, progressIn, riseAt, segmentOf } from './timeline'

/**
 * Turns scroll progress into the story: which beat is on, and what gets built.
 * Motion (ship, camera, each landmark's rise) is read straight from the scroll
 * by the scene and rewinds with it; what is built here is built once and stays.
 * Stepped by scene/story/ScrollDriver on rendered frames, and does nothing
 * unless the scroll moved.
 */

/** The scripted clicks already played, per quest. */
const clicked = new Map<string, number>()
let last = -1
let finished = false

/** How long the crew cheers once they stand at the cabin and the sun starts down. */
const PARTY_S = 3.5

/** One of the quest's `clicks`: its tool on that tile, as if the visitor had done it by hand. */
function click(q: Quest, k: number) {
  const [dx, dz] = q.clicks[k]
  const x = q.area.x + dx
  const z = q.area.z + dz
  const { height, type } = useIslandStore.getState()
  const i = idx(x, z)
  applyTool(q.tool, { x, z }, false, new Vector3(x - HALF + 0.5, surfaceY(height[i], type[i]), z - HALF + 0.5), true)
  wake(600)
}

export function stepScrollDirector() {
  const value = scroll.value
  if (value === last || !isTourActive()) return
  last = value
  const story = useStoryStore.getState()

  const { seg } = beatAt(value)
  if (seg.part !== story.beat.part || seg.stop !== story.beat.stop) {
    // The one timed bit of the tour: a cheer as the sunset begins (on the way forward).
    if (seg.part === 'sunset' && story.beat.part === 'gather') crewParty(PARTY_S)
    story.setBeat({ part: seg.part, stop: seg.stop })
  }

  // Build every stop the scroll has reached, in order. One scrolled past in a
  // single jump (the scrollbar, Skip) is placed without its clicks: placeLandmark
  // fills in whatever is missing.
  for (;;) {
    const q = TOUR[useStoryStore.getState().questIndex]
    if (!q) break
    const stretch = segmentOf('build', TOUR.indexOf(q))
    if (value < stretch.from) break
    const t = progressIn(stretch, value)
    if (t < 1) {
      const due = clicksDue(q.clicks.length, t)
      for (let k = clicked.get(q.id) ?? 0; k < due; k++) click(q, k)
      clicked.set(q.id, due)
      if (t < PLACE_AT) break
    }
    story.completeQuest(q.id)
  }

  if (seg.part === 'contact' && !finished) {
    finished = true
    track('tour_finished')
  }
}

/** How far a quest's landmark has risen (0..1): with the scroll during the tour, standing after it. */
export function riseOf(questId: string): number {
  const stop = TOUR.findIndex((q) => q.id === questId)
  if (stop < 0 || !isTourActive()) return 1
  return riseAt(stop, scroll.value)
}

/** The same, for scenery found by its landmark kind (the cabin, the falls). */
export function riseOfKind(kind: LandmarkKind): number {
  const q = TOUR.find((q) => q.landmark === kind)
  return q ? riseOf(q.id) : 1
}
