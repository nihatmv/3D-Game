import { BufferAttribute, BufferGeometry, Color } from 'three'
import { BEVEL, GRID, HALF, ISLAND_BOTTOM, PALETTE, SEA_Y, TileType } from './constants'
import { hash2 } from './grid'
import { NS, RES, bevelDrop, sampleCoord, type TerrainField } from './terrainField'

/**
 * Builds the island mesh from smooth terrain layers (see terrainField.ts).
 *
 * For each layer, marching squares over the fine sample grid gives:
 *  - the filled top surface (with a soft bevel dipping toward the outline),
 *  - the outline segments, extruded down into strata-banded walls.
 * Cells fully covered by the next layer up are skipped.
 *
 * Every vertex also carries `aAnim = (tile, weight, gap)`: which tile it
 * belongs to, how strongly it follows that tile's animated height offset (1 at
 * the top, 0 at a wall's base), and how far its layer sits below the tile's own
 * surface. Edits then glide in the vertex shader without rebuilds.
 */

const STRATA_H = 0.25
const LIP_H = 0.06

const colGrass = new Color(PALETTE.grass)
const colSand = new Color(PALETTE.sand)
const colStone = new Color(PALETTE.stone)
const colPondBed = new Color(PALETTE.pondBed)
const colWetSand = new Color(PALETTE.wetSand)
const colStrata = PALETTE.strata.map((c) => new Color(c))

export function topColor(level: number, type: number, out: Color): Color {
  switch (type) {
    case TileType.Soil:
      // Raised land keeps the island's natural look (sand at beach level,
      // grass above); it stays Soil internally so trees still prefer it.
      return out.copy(level <= 1 ? colSand : colGrass)
    case TileType.Stone:
      // Stones sit on the natural ground; just a hint of grey around them.
      return out.copy(level <= 1 ? colSand : colGrass).lerp(colStone, 0.12)
    case TileType.Water:
      return out.copy(colPondBed)
    default:
      return out.copy(level <= 1 ? colSand : colGrass)
  }
}

/** Growable typed buffer. */
class Buf<T extends Float32Array | Uint32Array> {
  length = 0
  data: T
  constructor(data: T) {
    this.data = data
  }
  push(a: number, b?: number, c?: number) {
    if (this.length + 3 > this.data.length) {
      const next = new (this.data.constructor as { new (n: number): T })(this.data.length * 2)
      next.set(this.data)
      this.data = next
    }
    this.data[this.length++] = a
    if (b !== undefined) this.data[this.length++] = b
    if (c !== undefined) this.data[this.length++] = c
  }
  slice(): T {
    return this.data.slice(0, this.length) as T
  }
}

const pos = new Buf(new Float32Array(1 << 16))
const col = new Buf(new Float32Array(1 << 16))
const anim = new Buf(new Float32Array(1 << 16))
const index = new Buf(new Uint32Array(1 << 16))

let vertexCount = 0
/** Surface y of the layer being built; each vertex records its gap below its tile's surface. */
let layerValue = 0
let tileSurfRef: Float32Array = new Float32Array(0)
function vertex(x: number, y: number, z: number, c: Color, tile: number, weight: number): number {
  pos.push(x, y, z)
  col.push(c.r, c.g, c.b)
  anim.push(tile, weight, Math.max(0, tileSurfRef[tile] - layerValue))
  return vertexCount++
}

/** Add a triangle, flipping winding so its face normal agrees with the hint. */
function tri(a: number, b: number, c: number, nx: number, ny: number, nz: number) {
  const p = pos.data
  const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2]
  const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2]
  const fx = uy * vz - uz * vy
  const fy = uz * vx - ux * vz
  const fz = ux * vy - uy * vx
  if (Math.abs(fx) + Math.abs(fy) + Math.abs(fz) < 1e-10) return
  if (fx * nx + fy * ny + fz * nz >= 0) index.push(a, b, c)
  else index.push(a, c, b)
}

const tmp = new Color()
const lip = new Color()

function strataColor(yMid: number, out: Color): Color {
  const band = Math.floor((yMid + 10) / STRATA_H)
  out.copy(colStrata[Math.floor(hash2(band, 17) * colStrata.length)])
  if (yMid < SEA_Y) out.lerp(colWetSand, Math.min(1, 0.5 + -yMid * 0.4))
  return out
}

// Per-layer vertex caches: corner samples and edge crossings are shared.
const cornerIdx = new Int32Array(NS * NS)
const edgeH = new Int32Array(NS * NS) // crossing on edge (u,r)-(u+1,r)
const edgeV = new Int32Array(NS * NS) // crossing on edge (u,r)-(u,r+1)
const STEP = 1 / RES // world distance between samples
const tileCols = new Float32Array(GRID * GRID * 3)
const ins = [false, false, false, false]
const poly: number[] = []
const isCross: boolean[] = []

export function buildTerrainGeometry(height: Uint8Array, type: Uint8Array, tf: TerrainField): BufferGeometry {
  pos.length = col.length = anim.length = index.length = 0
  vertexCount = 0
  const { values, fields, tileSurf } = tf
  tileSurfRef = tileSurf

  /** The tile a point on layer value `v` belongs to: the nearest tile at least that high. */
  const assignTile = (x: number, z: number, v: number): number => {
    const tx = Math.floor(x + HALF)
    const tz = Math.floor(z + HALF)
    if (tx >= 0 && tz >= 0 && tx < GRID && tz < GRID && tileSurf[tz * GRID + tx] >= v - 1e-6) return tz * GRID + tx
    let best = -1
    let bestD = Infinity
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = tx + dx
        const nz = tz + dz
        if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue
        const i = nz * GRID + nx
        if (tileSurf[i] < v - 1e-6) continue
        const d = (nx - HALF + 0.5 - x) ** 2 + (nz - HALF + 0.5 - z) ** 2
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
    }
    return best >= 0 ? best : Math.min(GRID - 1, Math.max(0, tz)) * GRID + Math.min(GRID - 1, Math.max(0, tx))
  }

  // Per-tile top colours, computed once per build.
  for (let i = 0; i < GRID * GRID; i++) {
    topColor(height[i], type[i], tmp).multiplyScalar(0.96 + hash2(i % GRID, (i / GRID) | 0) * 0.08)
    tileCols[i * 3] = tmp.r
    tileCols[i * 3 + 1] = tmp.g
    tileCols[i * 3 + 2] = tmp.b
  }
  const tileTop = (tile: number, out: Color) => out.setRGB(tileCols[tile * 3], tileCols[tile * 3 + 1], tileCols[tile * 3 + 2])

  /**
   * Colour for a top vertex on layer `v`: the nearest tile whose own surface IS
   * this layer (so the ground around a raised tile keeps its grass/sand colour
   * instead of taking the raised tile's soil colour).
   */
  const layerColor = (x: number, z: number, v: number, owner: number, out: Color): Color => {
    if (Math.abs(tileSurf[owner] - v) < 1e-6) return tileTop(owner, out)
    const tx = Math.floor(x + HALF)
    const tz = Math.floor(z + HALF)
    let best = owner
    let bestD = Infinity
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = tx + dx
        const nz = tz + dz
        if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue
        const i = nz * GRID + nx
        if (Math.abs(tileSurf[i] - v) >= 1e-6) continue
        const d = (nx - HALF + 0.5 - x) ** 2 + (nz - HALF + 0.5 - z) ** 2
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
    }
    return tileTop(best, out)
  }

  for (let k = 0; k < values.length; k++) {
    const v = values[k]
    layerValue = v
    const F = fields[k]
    const Fn = k + 1 < values.length ? fields[k + 1] : null
    const yTop = v - BEVEL
    const yBottom = k > 0 ? values[k - 1] - BEVEL : ISLAND_BOTTOM
    cornerIdx.fill(-1)
    edgeH.fill(-1)
    edgeV.fill(-1)

    const corner = (u: number, r: number): number => {
      const s = r * NS + u
      if (cornerIdx[s] >= 0) return cornerIdx[s]
      const x = sampleCoord(u)
      const z = sampleCoord(r)
      const tile = assignTile(x, z, v)
      return (cornerIdx[s] = vertex(x, v - bevelDrop(F[s]), z, layerColor(x, z, v, tile, tmp), tile, 1))
    }

    /** Crossing on the edge from sample (u,r) to its right (horizontal) or lower (vertical) neighbour. */
    const crossing = (u: number, r: number, horizontal: boolean): number => {
      const s1 = r * NS + u
      const cache = horizontal ? edgeH : edgeV
      if (cache[s1] >= 0) return cache[s1]
      const s2 = horizontal ? s1 + 1 : s1 + NS
      const f1 = F[s1]
      const f2 = F[s2]
      const t = Math.abs(f2 - f1) < 1e-9 ? 0.5 : (0.5 - f1) / (f2 - f1)
      const x = sampleCoord(u) + (horizontal ? t * STEP : 0)
      const z = sampleCoord(r) + (horizontal ? 0 : t * STEP)
      const tile = assignTile(x, z, v)
      return (cache[s1] = vertex(x, yTop, z, layerColor(x, z, v, tile, tmp), tile, 1))
    }

    /** Extrude an outline segment between two crossing vertices into a banded wall. */
    const wall = (ia: number, ib: number, nx: number, nz: number) => {
      const p = pos.data
      const ax = p[ia * 3], az = p[ia * 3 + 2]
      const bx = p[ib * 3], bz = p[ib * 3 + 2]
      const ta = anim.data[ia * 3]
      const tb = anim.data[ib * 3]
      tileTop(ta, lip).multiplyScalar(0.82)
      const cuts: number[] = [yTop]
      if (yTop - LIP_H > yBottom + 1e-3) cuts.push(yTop - LIP_H)
      for (let s = Math.floor((yTop - LIP_H) / STRATA_H); s * STRATA_H > yBottom + 1e-3; s--) {
        const y = s * STRATA_H
        if (y < cuts[cuts.length - 1] - 1e-3) cuts.push(y)
      }
      cuts.push(yBottom)
      const span = yTop - yBottom
      for (let c = 0; c + 1 < cuts.length; c++) {
        const y0 = cuts[c]
        const y1 = cuts[c + 1]
        const color = c === 0 && cuts.length > 2 ? lip : strataColor((y0 + y1) / 2, tmp)
        const w0 = (y0 - yBottom) / span
        const w1 = (y1 - yBottom) / span
        const a0 = vertex(ax, y0, az, color, ta, w0)
        const b0 = vertex(bx, y0, bz, color, tb, w0)
        const a1 = vertex(ax, y1, az, color, ta, w1)
        const b1 = vertex(bx, y1, bz, color, tb, w1)
        tri(a0, b0, a1, nx, 0, nz)
        tri(b0, b1, a1, nx, 0, nz)
      }
    }

    const cornerAt = (q: number, u: number, r: number) =>
      q === 0 ? corner(u, r) : q === 1 ? corner(u + 1, r) : q === 2 ? corner(u + 1, r + 1) : corner(u, r + 1)
    const edgeAt = (q: number, u: number, r: number) =>
      q === 0 ? crossing(u, r, true) : q === 1 ? crossing(u + 1, r, false) : q === 2 ? crossing(u, r + 1, true) : crossing(u, r, false)

    // Only scan the rows/columns this layer actually touches.
    let r0 = NS, r1 = -1, u0 = NS, u1 = -1
    for (let r = 0; r < NS; r++) {
      for (let u = 0; u < NS; u++) {
        if (F[r * NS + u] < 0.5) continue
        if (r < r0) r0 = r
        if (r > r1) r1 = r
        if (u < u0) u0 = u
        if (u > u1) u1 = u
      }
    }
    r0 = Math.max(0, r0 - 1)
    u0 = Math.max(0, u0 - 1)
    r1 = Math.min(NS - 2, r1)
    u1 = Math.min(NS - 2, u1)

    for (let r = r0; r <= r1; r++) {
      for (let u = u0; u <= u1; u++) {
        const sa = r * NS + u
        const fa = F[sa], fb = F[sa + 1], fc = F[sa + NS + 1], fd = F[sa + NS]
        const ina = fa >= 0.5, inb = fb >= 0.5, inc = fc >= 0.5, ind = fd >= 0.5
        if (!ina && !inb && !inc && !ind) continue
        // Hidden under the next layer up: skip entirely.
        if (Fn && Fn[sa] >= 0.52 && Fn[sa + 1] >= 0.52 && Fn[sa + NS + 1] >= 0.52 && Fn[sa + NS] >= 0.52) continue

        // Outward direction = against the field gradient.
        const gx = fb + fc - fa - fd
        const gz = fc + fd - fa - fb
        const gl = Math.hypot(gx, gz) || 1
        const ox = -gx / gl
        const oz = -gz / gl

        // Corners in order a(u,r) b(u+1,r) c(u+1,r+1) d(u,r+1), edge q runs corner q -> q+1.
        ins[0] = ina
        ins[1] = inb
        ins[2] = inc
        ins[3] = ind

        const saddle = ina === inc && inb === ind && ina !== inb
        const center = (fa + fb + fc + fd) / 4
        if (saddle && center < 0.5) {
          // Two separate inside corners: one triangle + wall segment each.
          for (let q = 0; q < 4; q++) {
            if (!ins[q]) continue
            const cIdx = cornerAt(q, u, r)
            const eOut = edgeAt(q, u, r)
            const eIn = edgeAt((q + 3) % 4, u, r)
            tri(cIdx, eOut, eIn, 0, 1, 0)
            const p = pos.data
            // Local outward normal for this corner piece: away from the corner.
            const mx = (p[eOut * 3] + p[eIn * 3]) / 2 - p[cIdx * 3]
            const mz = (p[eOut * 3 + 2] + p[eIn * 3 + 2]) / 2 - p[cIdx * 3 + 2]
            wall(eIn, eOut, mx, mz)
          }
          continue
        }

        poly.length = 0
        isCross.length = 0
        for (let q = 0; q < 4; q++) {
          if (ins[q]) {
            poly.push(cornerAt(q, u, r))
            isCross.push(false)
          }
          if (ins[q] !== ins[(q + 1) % 4]) {
            poly.push(edgeAt(q, u, r))
            isCross.push(true)
          }
        }
        for (let t = 1; t + 1 < poly.length; t++) tri(poly[0], poly[t], poly[t + 1], 0, 1, 0)
        // Outline segments: consecutive crossings in the walk.
        for (let t = 0; t < poly.length; t++) {
          const n = (t + 1) % poly.length
          if (isCross[t] && isCross[n] && poly.length > 2) wall(poly[t], poly[n], ox, oz)
        }
      }
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos.slice(), 3))
  geo.setAttribute('color', new BufferAttribute(col.slice(), 3))
  geo.setAttribute('aAnim', new BufferAttribute(anim.slice(), 3))
  geo.setIndex(new BufferAttribute(index.slice(), 1))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  geo.computeBoundingBox()
  return geo
}
