import { TileType } from './constants'

export const PLANT_KINDS = ['tuft', 'bush', 'flower', 'tree', 'pine', 'reed', 'cattail'] as const
export type PlantKind = (typeof PLANT_KINDS)[number]

export const MAX_PLANTS_PER_TILE = 6
export const MAX_PLANTS = 1200

export type TileContext = {
  level: number
  type: number
  stones: number
  /** Any of the 8 neighbours is a pond or open ocean. */
  nearWater: boolean
  plantsOnTile: number
  hasTree: boolean
}

/**
 * Decide what a seed grows into on a given tile, or null if it can't grow.
 * `rand` is a uniform [0, 1) source, injected so the rules stay pure/testable.
 */
export function plantRules(ctx: TileContext, rand: () => number): PlantKind | null {
  if (ctx.level <= 0 || ctx.type === TileType.Water) return null
  if (ctx.stones > 0 || ctx.type === TileType.Stone) return null
  if (ctx.plantsOnTile >= MAX_PLANTS_PER_TILE) return null

  if (ctx.nearWater) return rand() < 0.5 ? 'reed' : 'cattail'

  if (ctx.type === TileType.Soil) {
    if (!ctx.hasTree && rand() < 0.6) return rand() < 0.5 ? 'tree' : 'pine'
    return 'bush'
  }

  // Grass (and sand beaches away from the water).
  const r = rand()
  if (r < 0.6) return 'tuft'
  if (r < 0.9) return 'bush'
  return 'flower'
}

export const isTree = (k: PlantKind) => k === 'tree' || k === 'pine'
