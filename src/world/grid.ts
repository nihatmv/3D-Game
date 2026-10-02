import { GRID, TILE_COUNT, TileType } from './constants'
import { DECOR_PATH, HIGHLAND, HIGHLAND_X, HIGHLAND_Z } from './decor'

export const idx = (x: number, z: number) => z * GRID + x

export const inBounds = (x: number, z: number) => x >= 0 && z >= 0 && x < GRID && z < GRID

/** Height at (x, z); anything outside the grid counts as open ocean. */
export function heightAt(height: Uint8Array, x: number, z: number): number {
  return inBounds(x, z) ? height[idx(x, z)] : 0
}

export const N4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export const N8: ReadonlyArray<readonly [number, number]> = [
  ...N4,
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

/** Deterministic hash in [0, 1) for integer-ish inputs. */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const BACK_ANGLE = Math.atan2(-1, 0.5)

/**
 * The starting island: an organic disc in the middle of the grid, flat at level 2,
 * plus the hand-drawn highland from decor.ts (hills, the falls' cliff and pool).
 */
export function initialIsland(): { height: Uint8Array; type: Uint8Array } {
  const height = new Uint8Array(TILE_COUNT)
  const type = new Uint8Array(TILE_COUNT).fill(TileType.Grass)
  const c = (GRID - 1) / 2
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const dx = x - c
      const dz = z - c
      const d = Math.hypot(dx, dz)
      const a = Math.atan2(dz, dx)
      // Bulges toward the back (−z, top-right of the default view) to carry the highland.
      const back = Math.max(0, Math.cos(a - BACK_ANGLE)) ** 2
      const r = 5.6 + Math.sin(3 * a + 1.2) * 0.8 + Math.sin(5 * a + 2.1) * 0.45 + back * 2.6
      if (d < r) height[idx(x, z)] = 2
      else if (d < r + 1.3) height[idx(x, z)] = 1
    }
  }
  forEachHighland((x, z, c) => {
    const i = idx(x, z)
    height[i] = c === '~' ? 2 : Number(c)
    if (c === '~') type[i] = TileType.Water
  })
  // A beach ring round the highland, like the base island's.
  const land = height.slice()
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (land[idx(x, z)] > 0) continue
      if (N8.some(([dx, dz]) => inBounds(x + dx, z + dz) && land[idx(x + dx, z + dz)] >= 2)) height[idx(x, z)] = 1
    }
  }
  return { height, type }
}

function forEachHighland(fn: (x: number, z: number, c: string) => void) {
  HIGHLAND.forEach((row, dz) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] !== '.') fn(HIGHLAND_X + dx, HIGHLAND_Z + dz, row[dx])
  })
}

/** Tiles locked from the start: the highland, its falls and pool, and the stone path, so tools can't break the scenery. */
export function initialLocked(): Uint8Array {
  const locked = new Uint8Array(TILE_COUNT)
  forEachHighland((x, z) => (locked[idx(x, z)] = 1))
  // Every tile the stone path crosses.
  for (let k = 1; k < DECOR_PATH.length; k++) {
    const [ax, az] = DECOR_PATH[k - 1]
    const [bx, bz] = DECOR_PATH[k]
    for (let t = 0; t <= 1; t += 0.05) {
      const x = Math.round(ax + (bx - ax) * t)
      const z = Math.round(az + (bz - az) * t)
      if (inBounds(x, z)) locked[idx(x, z)] = 1
    }
  }
  return locked
}

/** Does (x, z) share an edge with a land tile? New land can only grow from the shore. */
export function touchesLand(height: Uint8Array, x: number, z: number): boolean {
  return N4.some(([dx, dz]) => heightAt(height, x + dx, z + dz) > 0)
}
