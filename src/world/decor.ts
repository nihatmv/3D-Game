import type { PlantKind } from './plantRules'

/**
 * Hand-placed scenery on the starting island, so the first frame looks
 * lived-in. Tiles are grid coordinates; keep them clear of every quest
 * `area` in quests.ts, the grove around the tree quest, and the pier row
 * (z = 16, west shore).
 */

/**
 * The highland at the back of the island (top-right of the default view):
 * one row per z, one character per x starting at HIGHLAND_X. Digits are
 * height levels, `~` is the plunge pool (water at level 2) under the falls,
 * `.` leaves the base island alone. Every non-`.` tile is locked against tools.
 * The falls pour off the level-5 tiles straight above the pool.
 */
export const HIGHLAND_X = 14
export const HIGHLAND_Z = 3
export const HIGHLAND: ReadonlyArray<string> = [
  '....111.....',
  '...1234321..',
  '..23466543..',
  '.2345665532.',
  '.2335555532.',
  '.2335555532.',
  '.223555542..',
  '..22~~~432..',
  '...2~~~22...',
]

/** The waterfall: its lip runs along the +z edge of tiles x..x+width-1 on row z. */
export const DECOR_FALLS = { x: 18, z: 9, width: 3 }

/**
 * The wooden cabin on the plateau beside the spring (centred between its four
 * tiles, which must share a level); `rot` turns its door toward the camera.
 */
export const DECOR_CABIN = { x: 21.5, z: 7.15, rot: 0.4 }

/**
 * The stone path from the cabin's porch down the terraces to the sea on the east beach:
 * waypoints in tile coordinates (a tile's centre is its integer x/z). Stones
 * follow the ground, with steps wherever it drops a level; its tiles are locked.
 */
export const DECOR_PATH: ReadonlyArray<readonly [number, number]> = [
  [22.1, 8.05],
  [22.05, 9.5],
  [22.15, 10.3],
  [22.35, 11.0],
  [23.0, 11.4],
  [23.8, 11.5],
  [24.6, 11.6],
]

export const DECOR_PLANTS: ReadonlyArray<{ x: number; z: number; kind: PlantKind }> = [
  // Pines on the highland, framing the falls from behind.
  { x: 21, z: 5, kind: 'pine' },
  { x: 23, z: 7, kind: 'pine' },
  { x: 17, z: 5, kind: 'pine' },
  { x: 23, z: 9, kind: 'tree' },
  // Trees along the back so they frame the island without hiding landmarks.
  { x: 15, z: 11, kind: 'pine' },
  { x: 19, z: 13, kind: 'pine' },
  { x: 11, z: 12, kind: 'tree' },
  { x: 22, z: 13, kind: 'tree' },
  // Bushes, flowers and grass tufts.
  { x: 21, z: 16, kind: 'bush' },
  { x: 11, z: 14, kind: 'bush' },
  { x: 15, z: 9, kind: 'bush' },
  { x: 16, z: 20, kind: 'flower' },
  { x: 12, z: 20, kind: 'flower' },
  { x: 20, z: 18, kind: 'flower' },
  { x: 16, z: 11, kind: 'flower' },
  { x: 11, z: 18, kind: 'tuft' },
  { x: 19, z: 15, kind: 'tuft' },
  { x: 16, z: 13, kind: 'tuft' },
  { x: 15, z: 21, kind: 'tuft' },
  // Reeds by the plunge pool and on the beach ring.
  { x: 17, z: 11, kind: 'cattail' },
  { x: 21, z: 11, kind: 'reed' },
  { x: 12, z: 10, kind: 'reed' },
  { x: 22, z: 14, kind: 'reed' },
  { x: 14, z: 21, kind: 'cattail' },
  { x: 17, z: 21, kind: 'reed' },
]

/** Boulders (stack height 1–2). */
export const DECOR_STONES: ReadonlyArray<{ x: number; z: number; n: number }> = [
  { x: 20, z: 17, n: 1 },
  { x: 12, z: 19, n: 1 },
  // Rocks around the spring at the top of the falls.
  { x: 17, z: 9, n: 1 },
  { x: 18, z: 8, n: 1 },
]
