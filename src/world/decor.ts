import type { PlantKind } from './plantRules'

/**
 * Hand-placed decoration on the starting island, so the first frame looks
 * lived-in. Tiles are grid coordinates; keep them clear of every quest
 * `area` in quests.ts and of the pier row (z = 16, west shore).
 */

export const DECOR_PLANTS: ReadonlyArray<{ x: number; z: number; kind: PlantKind }> = [
  // Trees along the back so they frame the island without hiding landmarks.
  { x: 17, z: 11, kind: 'tree' },
  { x: 19, z: 13, kind: 'pine' },
  { x: 15, z: 10, kind: 'pine' },
  { x: 11, z: 12, kind: 'tree' },
  // Bushes, flowers and grass tufts.
  { x: 21, z: 16, kind: 'bush' },
  { x: 11, z: 14, kind: 'bush' },
  { x: 16, z: 20, kind: 'flower' },
  { x: 12, z: 20, kind: 'flower' },
  { x: 20, z: 18, kind: 'flower' },
  { x: 11, z: 18, kind: 'tuft' },
  { x: 19, z: 15, kind: 'tuft' },
  { x: 16, z: 13, kind: 'tuft' },
  { x: 15, z: 21, kind: 'tuft' },
  // Reeds on the beach ring.
  { x: 12, z: 10, kind: 'reed' },
  { x: 18, z: 10, kind: 'cattail' },
  { x: 22, z: 14, kind: 'reed' },
  { x: 14, z: 21, kind: 'cattail' },
  { x: 17, z: 21, kind: 'reed' },
]

/** Boulders (stack height 1–2). */
export const DECOR_STONES: ReadonlyArray<{ x: number; z: number; n: number }> = [
  { x: 20, z: 17, n: 1 },
  { x: 16, z: 11, n: 2 },
  { x: 12, z: 19, n: 1 },
]
