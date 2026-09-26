import { BufferAttribute, BufferGeometry, Color } from 'three'
import { BEVEL, GRID, ISLAND_BOTTOM, PALETTE, SEA_Y, TileType, surfaceY, tileMin } from './constants'
import { hash2, idx, inBounds } from './grid'

/**
 * Builds the island terrain as one flat-shaded, vertex-coloured mesh.
 *
 * Each land tile's top is a 4x4 grid of sub-vertices at offsets [0, b, 1-b, 1].
 * Border sub-vertices drop by `b` where a neighbour (edge or corner) is lower,
 * which yields a chamfer ring. Where a neighbour is lower, a wall runs from this
 * tile's border down to the neighbour's matching border vertices, so the mesh
 * stays watertight at every step. Walls are banded into strata colours.
 */

const S = [0, BEVEL, 1 - BEVEL, 1]
const STRATA_H = 0.25
const LIP_H = 0.06
const JITTER = 0.05

const colGrass = new Color(PALETTE.grass)
const colSand = new Color(PALETTE.sand)
const colSoil = new Color(PALETTE.soil)
const colStoneTop = new Color(PALETTE.stone)
const colPondBed = new Color(PALETTE.pondBed)
const colWetSand = new Color(PALETTE.wetSand)
const colStrata = PALETTE.strata.map((c) => new Color(c))

export function topColor(level: number, type: number, out: Color): Color {
  switch (type) {
    case TileType.Soil:
      return out.copy(colSoil)
    case TileType.Stone:
      // Stones sit on the natural ground; just a hint of grey around them.
      return out.copy(level <= 1 ? colSand : colGrass).lerp(colStoneTop, 0.12)
    case TileType.Water:
      return out.copy(colPondBed)
    default:
      return out.copy(level <= 1 ? colSand : colGrass)
  }
}

/** Growable float buffer so we avoid JS array push overhead. */
class FloatBuf {
  data = new Float32Array(1 << 16)
  length = 0
  reset() {
    this.length = 0
  }
  push3(a: number, b: number, c: number) {
    if (this.length + 3 > this.data.length) {
      const next = new Float32Array(this.data.length * 2)
      next.set(this.data)
      this.data = next
    }
    const d = this.data
    d[this.length++] = a
    d[this.length++] = b
    d[this.length++] = c
  }
  slice() {
    return this.data.slice(0, this.length)
  }
}

const pos = new FloatBuf()
const nor = new FloatBuf()
const col = new FloatBuf()

const jitterX = (x: number, z: number) => (hash2(Math.round(x * 100), Math.round(z * 100)) - 0.5) * 2 * JITTER
const jitterZ = (x: number, z: number) => (hash2(Math.round(z * 100) + 7919, Math.round(x * 100)) - 0.5) * 2 * JITTER

/**
 * Push a triangle (positions pre-jitter), flipping winding so its face normal
 * agrees with the hint (nx, ny, nz). Degenerate triangles are dropped.
 */
function tri(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  nx: number, ny: number, nz: number,
  color: Color,
) {
  const ux = bx - ax, uy = by - ay, uz = bz - az
  const vx = cx - ax, vy = cy - ay, vz = cz - az
  let fx = uy * vz - uz * vy
  let fy = uz * vx - ux * vz
  let fz = ux * vy - uy * vx
  if (Math.abs(fx) + Math.abs(fy) + Math.abs(fz) < 1e-9) return
  const flip = fx * nx + fy * ny + fz * nz < 0

  // Jitter xz by position so shared vertices stay welded.
  const Ax = ax + jitterX(ax, az), Az = az + jitterZ(ax, az)
  let Bx = bx + jitterX(bx, bz), Bz = bz + jitterZ(bx, bz), By = by
  let Cx = cx + jitterX(cx, cz), Cz = cz + jitterZ(cx, cz), Cy = cy
  if (flip) {
    let t = Bx; Bx = Cx; Cx = t
    t = By; By = Cy; Cy = t
    t = Bz; Bz = Cz; Cz = t
  }
  // Flat normal from the final (jittered) triangle.
  const px = Bx - Ax, py = By - ay, pz = Bz - Az
  const qx = Cx - Ax, qy = Cy - ay, qz = Cz - Az
  fx = py * qz - pz * qy
  fy = pz * qx - px * qz
  fz = px * qy - py * qx
  const len = Math.hypot(fx, fy, fz) || 1
  fx /= len; fy /= len; fz /= len

  pos.push3(Ax, ay, Az)
  pos.push3(Bx, By, Bz)
  pos.push3(Cx, Cy, Cz)
  for (let k = 0; k < 3; k++) {
    nor.push3(fx, fy, fz)
    col.push3(color.r, color.g, color.b)
  }
}

const tmp = new Color()
const top = new Color()
const lip = new Color()

function strataColor(yMid: number, out: Color): Color {
  const band = Math.floor((yMid + 10) / STRATA_H)
  out.copy(colStrata[Math.floor(hash2(band, 17) * colStrata.length)])
  if (yMid < SEA_Y) out.lerp(colWetSand, Math.min(1, 0.5 + -yMid * 0.4))
  return out
}

/**
 * Wall between points A and B along a tile edge. `yt` is the (flat) top,
 * `ybA`/`ybB` are the neighbour's border heights, (nx, nz) the outward normal.
 */
function wall(
  ax: number, az: number, bx: number, bz: number,
  ytA: number, ytB: number, ybA: number, ybB: number,
  nx: number, nz: number,
) {
  const yMaxB = Math.max(ybA, ybB)
  const yt = Math.min(ytA, ytB)
  if (Math.max(ytA - ybA, ytB - ybB) < 1e-4) return
  // The first band starts from the (possibly sloped) top edge.
  let yPrevA = ytA
  let yPrevB = ytB
  let yPrev = yt
  let first = true
  const emitBand = (y: number, c: Color) => {
    tri(ax, yPrevA, az, bx, yPrevB, bz, ax, y, az, nx, 0, nz, c)
    tri(bx, yPrevB, bz, bx, y, bz, ax, y, az, nx, 0, nz, c)
    yPrev = yPrevA = yPrevB = y
    first = false
  }
  // Thin grass-coloured lip, then horizontal strata bands.
  if (yt - LIP_H > yMaxB + 1e-3) emitBand(yt - LIP_H, lip)
  for (let k = Math.floor((yt - LIP_H) / STRATA_H); k * STRATA_H > yMaxB + 1e-3; k--) {
    const y = k * STRATA_H
    if (y < yPrev - 1e-3) emitBand(y, strataColor((yPrev + y) / 2, tmp))
  }
  // Last band follows the neighbour's (possibly sloped) border.
  const c = first ? lip : strataColor((yPrev + yMaxB) / 2, tmp)
  tri(ax, yPrevA, az, bx, yPrevB, bz, ax, ybA, az, nx, 0, nz, c)
  tri(bx, yPrevB, bz, bx, ybB, bz, ax, ybA, az, nx, 0, nz, c)
}

const ys = new Float32Array(16)
const SIDES = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const

/** Surface y used for ocean tiles when animating (fully sunk below the island base). */
export const OCEAN_Y = ISLAND_BOTTOM
/** Tiles whose (animated) surface is below this are treated as open ocean. */
const LAND_CUTOFF = ISLAND_BOTTOM + 0.15

/** Resting surface y of every tile (ocean tiles get OCEAN_Y). */
export function targetSurfaces(height: Uint8Array, type: Uint8Array, out: Float32Array): Float32Array {
  for (let i = 0; i < out.length; i++) out[i] = height[i] > 0 ? surfaceY(height[i], type[i]) : OCEAN_Y
  return out
}

/**
 * `surf` optionally overrides each tile's surface y (used to animate height
 * changes); `height`/`type` still decide colours.
 */
export function buildTerrainGeometry(height: Uint8Array, type: Uint8Array, surf?: Float32Array): BufferGeometry {
  pos.reset()
  nor.reset()
  col.reset()

  /** Ground surface y of a tile; -Infinity for ocean (and outside the grid). */
  const h = (x: number, z: number) => {
    if (!inBounds(x, z)) return -Infinity
    const i = idx(x, z)
    if (surf) return surf[i] > LAND_CUTOFF ? surf[i] : -Infinity
    return height[i] > 0 ? surfaceY(height[i], type[i]) : -Infinity
  }

  /** y of sub-vertex (i, j) of land tile (x, z). */
  const subY = (x: number, z: number, i: number, j: number): number => {
    const hh = h(x, z)
    const ex = i === 0 ? -1 : i === 3 ? 1 : 0
    const ez = j === 0 ? -1 : j === 3 ? 1 : 0
    // The highest of the lower neighbours sharing this vertex decides the
    // bevel: at most half the height gap, so the edge never dips below a
    // neighbour's surface (matters mid-animation, when gaps can be tiny).
    let any = false
    let lowMax = -Infinity
    const consider = (n: number) => {
      if (n < hh) {
        any = true
        if (n > lowMax) lowMax = n
      }
    }
    if (ex !== 0) consider(h(x + ex, z))
    if (ez !== 0) consider(h(x, z + ez))
    if (ex !== 0 && ez !== 0) consider(h(x + ex, z + ez))
    if (!any) return hh
    return hh - Math.min(BEVEL, (hh - lowMax) * 0.5)
  }

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const level = height[idx(x, z)]
      const hh = h(x, z)
      if (hh === -Infinity) continue
      const x0 = tileMin(x)
      const z0 = tileMin(z)

      topColor(level, type[idx(x, z)], top).multiplyScalar(0.96 + hash2(x, z) * 0.08)
      lip.copy(top).multiplyScalar(0.82)

      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) ys[j * 4 + i] = subY(x, z, i, j)

      // Top surface: 3x3 quads.
      for (let j = 0; j < 3; j++) {
        const za = z0 + S[j]
        const zc = z0 + S[j + 1]
        for (let i = 0; i < 3; i++) {
          const xa = x0 + S[i]
          const xb = x0 + S[i + 1]
          const ya = ys[j * 4 + i]
          const yb = ys[j * 4 + i + 1]
          const yc = ys[(j + 1) * 4 + i]
          const yd = ys[(j + 1) * 4 + i + 1]
          // Split along the diagonal that avoids the odd-one-out vertex, so
          // convex corners get a flat triangle and concave ones a small dimple.
          const oddIsBorC = ya === yd && (yb !== ya || yc !== ya)
          if (oddIsBorC) {
            tri(xa, ya, za, xa, yc, zc, xb, yd, zc, 0, 1, 0, top)
            tri(xa, ya, za, xb, yd, zc, xb, yb, za, 0, 1, 0, top)
          } else {
            tri(xa, ya, za, xa, yc, zc, xb, yb, za, 0, 1, 0, top)
            tri(xb, yb, za, xa, yc, zc, xb, yd, zc, 0, 1, 0, top)
          }
        }
      }

      // Walls where the neighbour is lower.
      for (const [dx, dz] of SIDES) {
        const nx = x + dx
        const nz = z + dz
        const nh = h(nx, nz)
        if (nh >= hh) continue
        for (let k = 0; k < 3; k++) {
          // Walk along the edge; the neighbour's matching border row/column
          // gives the wall's bottom so the seam is watertight.
          if (dz !== 0) {
            const j = dz < 0 ? 0 : 3
            const ez = z0 + S[j]
            wall(
              x0 + S[k], ez, x0 + S[k + 1], ez, ys[j * 4 + k], ys[j * 4 + k + 1],
              nh > -Infinity ? subY(nx, nz, k, 3 - j) : ISLAND_BOTTOM,
              nh > -Infinity ? subY(nx, nz, k + 1, 3 - j) : ISLAND_BOTTOM,
              dx, dz,
            )
          } else {
            const i = dx < 0 ? 0 : 3
            const ex = x0 + S[i]
            wall(
              ex, z0 + S[k], ex, z0 + S[k + 1], ys[k * 4 + i], ys[(k + 1) * 4 + i],
              nh > -Infinity ? subY(nx, nz, 3 - i, k) : ISLAND_BOTTOM,
              nh > -Infinity ? subY(nx, nz, 3 - i, k + 1) : ISLAND_BOTTOM,
              dx, dz,
            )
          }
        }
      }
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos.slice(), 3))
  geo.setAttribute('normal', new BufferAttribute(nor.slice(), 3))
  geo.setAttribute('color', new BufferAttribute(col.slice(), 3))
  geo.computeBoundingSphere()
  geo.computeBoundingBox()
  return geo
}
