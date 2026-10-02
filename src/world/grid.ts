import { GRID, TILE_COUNT, TileType } from './constants'

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

/** A flat, organically shaped starting island in the middle of the grid. */
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
      const r = 5.6 + Math.sin(3 * a + 1.2) * 0.8 + Math.sin(5 * a + 2.1) * 0.45
      if (d < r) height[idx(x, z)] = 2
      else if (d < r + 1.3) height[idx(x, z)] = 1
    }
  }
  return { height, type }
}

/** Does (x, z) share an edge with a land tile? New land can only grow from the shore. */
export function touchesLand(height: Uint8Array, x: number, z: number): boolean {
  return N4.some(([dx, dz]) => heightAt(height, x + dx, z + dz) > 0)
}
