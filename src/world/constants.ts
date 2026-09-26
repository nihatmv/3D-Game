export const GRID = 32
export const HALF = GRID / 2
export const TILE_COUNT = GRID * GRID

export const SEA_Y = 0
export const STEP = 0.5
export const BEVEL = 0.16
export const ISLAND_BOTTOM = -1.2
export const SEABED_Y = -0.8

export const MAX_LEVEL = 6
export const MAX_STONE = 4
export const GROW_MS = 10000

export const TileType = {
  Grass: 0,
  Soil: 1,
  Stone: 2,
  Water: 3,
} as const
export type TileType = (typeof TileType)[keyof typeof TileType]

/** World-space y of the top surface for a given height level. */
export function topY(level: number): number {
  return level <= 0 ? SEABED_Y : 0.2 + (level - 1) * STEP
}

/** Pond beds sit this far below their level so water fits under same-level banks. */
export const POND_DEPTH = 0.3

/** Actual ground surface y of a tile (pond tiles are sunken). */
export function surfaceY(level: number, type: number): number {
  return topY(level) - (type === TileType.Water && level > 0 ? POND_DEPTH : 0)
}

/** World-space x/z of a tile's minimum corner. */
export function tileMin(i: number): number {
  return i - HALF
}

export const PALETTE = {
  grass: '#9fd28a',
  sand: '#ecd9a8',
  soil: '#b98a5e',
  pondBed: '#c9b98a',
  strata: ['#a47a52', '#8a6445', '#9a7049', '#7a563a'],
  wetSand: '#8f7a5c',
  stone: '#c9c4bd',
  water: '#6fd6d0',
  deepWater: '#3fb8c2',
  sky: '#fbe3c8',
  sun: '#fff1dc',
  ground: '#b7d9c4',
}
