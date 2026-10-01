import { MAX_STONE, TILE_COUNT, TileType } from '../world/constants'
import { idx, inBounds, initialIsland } from '../world/grid'
import { isTree, type PlantKind } from '../world/plantRules'
import type { Tool } from '../store/useIslandStore'

/**
 * The captain's tasks, in order. Each one is pure data plus a condition that
 * reads the island state, so adding or reordering quests never touches game code.
 * Tour stops are one click each (`clicks`); `auto` quests are built in the ending.
 */

export type LandmarkKind = 'lighthouseBase' | 'lighthouseTop' | 'pondRipples' | 'pier' | 'bigTree'

/** Tile-space circle: centre tile and radius in tiles. */
export type Area = { x: number; z: number; r: number }

export type IslandSnapshot = {
  height: Uint8Array
  type: Uint8Array
  stones: Uint8Array
  plants: ReadonlyArray<{ tile: number; kind: PlantKind }>
}

export type Quest = {
  id: string
  /** Project unlocked by this quest (see projects.ts). */
  projectId: string
  /** The captain's instruction. */
  dialogue: string
  /** What the captain says once it's built. */
  doneLine: string
  tool: Tool
  area: Area
  condition: (s: IslandSnapshot, area: Area) => boolean
  /**
   * What one click on the glowing target does: the quest's tool is applied
   * on these tiles (offsets from the area centre), one after another.
   */
  clicks: ReadonlyArray<readonly [number, number]>
  landmark: LandmarkKind
  /** Not a tour stop: built automatically when the ship comes in to dock. */
  auto?: boolean
  /** Build on the same tile as an earlier quest's landmark. */
  anchorOf?: string
}

/** Tiles inside the area's circle. */
export function tilesInArea(a: Area): number[] {
  const out: number[] = []
  const r = Math.ceil(a.r)
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = a.x + dx
      const z = a.z + dz
      if (inBounds(x, z) && dx * dx + dz * dz <= a.r * a.r) out.push(idx(x, z))
    }
  }
  return out
}

/** The tile is on the area's glowing target (a little wider than its circle, for easy clicking). */
export function onTarget(a: Area, x: number, z: number): boolean {
  return (x - a.x) ** 2 + (z - a.z) ** 2 <= (a.r + 0.5) ** 2
}

export function countInArea(a: Area, pred: (i: number) => boolean): number {
  let n = 0
  for (const i of tilesInArea(a)) if (pred(i)) n++
  return n
}

export function sumInArea(a: Area, value: (i: number) => number): number {
  let n = 0
  for (const i of tilesInArea(a)) n += value(i)
  return n
}

/** Which tiles were open ocean at the start, so "extend the island" counts new land only. */
const startHeight = initialIsland().height
const wasOcean = new Uint8Array(TILE_COUNT)
for (let i = 0; i < TILE_COUNT; i++) wasOcean[i] = startHeight[i] === 0 ? 1 : 0

const plantsInArea = (s: IslandSnapshot, a: Area, pred: (kind: PlantKind) => boolean) => {
  const tiles = new Set(tilesInArea(a))
  let n = 0
  for (const p of s.plants) if (tiles.has(p.tile) && pred(p.kind)) n++
  return n
}

export const QUESTS: Quest[] = [
  {
    id: 'lighthouse-base',
    projectId: 'breathing-monitor',
    dialogue: 'Rocky waters out here. Let’s lay a stone base for a lighthouse.',
    doneLine: 'A solid foundation! Every good thing starts with the hardware.',
    tool: 'stone',
    area: { x: 13, z: 13, r: 1.5 },
    condition: (s, a) => sumInArea(a, (i) => s.stones[i]) >= 3,
    clicks: [[0, 0], [1, 0], [0, 1]],
    landmark: 'lighthouseBase',
  },
  {
    id: 'lighthouse-top',
    projectId: 'gitpulse',
    dialogue: 'Now raise the tower, and we’ll light the lamp!',
    doneLine: 'There it is, a beam across the water. Signals sent and received!',
    tool: 'stone',
    area: { x: 13, z: 13, r: 1.5 },
    condition: (s, a) => countInArea(a, (i) => s.stones[i] >= MAX_STONE) >= 1,
    // The base's tile is locked, so the tower goes up next to it.
    clicks: Array.from({ length: MAX_STONE }, () => [1, 0] as const),
    landmark: 'lighthouseTop',
    anchorOf: 'lighthouse-base',
  },
  {
    id: 'pond',
    projectId: 'cue',
    dialogue: 'Our water barrels are dry. A pond, please!',
    doneLine: 'Listen to those ripples. Waves turn into a signal.',
    tool: 'water',
    area: { x: 17, z: 15, r: 1.5 },
    condition: (s, a) => countInArea(a, (i) => s.type[i] === TileType.Water) >= 2,
    clicks: [[0, 0], [1, 0]],
    landmark: 'pondRipples',
  },
  {
    id: 'pier',
    projectId: 'remote-job-globe',
    dialogue: 'We can’t reach the shore from here. Raise some land out toward the ship!',
    doneLine: 'The island reaches out to the world. Nearly close enough to dock!',
    tool: 'soil',
    area: { x: 6, z: 16, r: 1.5 },
    condition: (s, a) => countInArea(a, (i) => wasOcean[i] === 1 && s.height[i] > 0) >= 3,
    clicks: [],
    landmark: 'pier',
    auto: true,
  },
  {
    id: 'tree',
    projectId: 'sabah-hub',
    dialogue: 'Last one: a bit of shade would be lovely.',
    doneLine: 'From a tiny seed to a full tree. That’s real growth.',
    tool: 'seeds',
    area: { x: 14, z: 18, r: 1.5 },
    condition: (s, a) => plantsInArea(s, a, () => true) >= 3 || plantsInArea(s, a, isTree) >= 1,
    clicks: [[0, 0], [0, 0], [0, 0]],
    landmark: 'bigTree',
  },
]

/** The tour stops, in order: every quest the visitor builds with one click. */
export const TOUR: Quest[] = QUESTS.filter((q) => !q.auto)
