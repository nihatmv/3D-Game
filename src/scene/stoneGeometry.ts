import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  SphereGeometry,
} from 'three'
import { hash2 } from '../world/grid'
import { BOULDER_RADIUS, BOULDER_SQUASH, DRUM_H, TOWER_RADIUS, WALL_THICKNESS } from '../world/stones'
import { build, rng, type Part } from './geomUtil'

/**
 * Stone props built from primitives, each merged into one vertex-coloured
 * geometry. All pieces have their base at local y = 0.
 */

const BRICKS = ['#dcd6cd', '#d1cbc1', '#e3ded6', '#cbc4ba', '#d8d0c4']
const MORTAR = '#9d968c'
const CAP_STONE = '#e2ddd4'
const MOSS = ['#8cc97a', '#7cbb68', '#9fd28a']

/** Low-poly boulder: an icosahedron with welded, hash-jittered vertices. */
export function makeBoulderGeometry(): BufferGeometry {
  const geo = new IcosahedronGeometry(BOULDER_RADIUS, 0)
  const p = geo.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    // Key by rounded position so shared vertices get the same offset.
    const k1 = Math.round(x * 1000) * 7 + Math.round(z * 1000)
    const k2 = Math.round(y * 1000)
    const s = 0.85 + hash2(k1, k2) * 0.3
    p.setXYZ(i, x * s, y * s * BOULDER_SQUASH, z * s)
  }
  // Stone pieces share a vertex-coloured material, so give the boulder its colour.
  return build([{ geo, color: '#c9c4bd' }])
}

/**
 * One drum of a round brick tower: rows of slightly protruding, individually
 * tinted bricks (staggered per row) around a darker mortar core.
 */
export function makeBrickDrum(): BufferGeometry {
  const r = rng(5)
  const rows = 3
  const perRow = 9
  const rOut = TOWER_RADIUS
  const rIn = TOWER_RADIUS - 0.03
  const gapA = 0.035
  const gapY = 0.014
  const rowH = DRUM_H / rows
  const pos: number[] = []
  const col: number[] = []
  const c = new Color()

  const P = (rad: number, a: number, y: number): [number, number, number] => [Math.cos(a) * rad, y, Math.sin(a) * rad]
  /** Push a quad, flipping winding to face along the hint. */
  const quad = (a: number[], b: number[], cc: number[], d: number[], hint: number[]) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2]
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
    const flip = n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0
    const tris = flip ? [a, cc, b, a, d, cc] : [a, b, cc, a, cc, d]
    for (const t of tris) {
      pos.push(t[0], t[1], t[2])
      col.push(c.r, c.g, c.b)
    }
  }

  for (let row = 0; row < rows; row++) {
    const y0 = row * rowH + gapY / 2
    const y1 = (row + 1) * rowH - gapY / 2
    const offset = (row % 2) * (Math.PI / perRow)
    for (let b = 0; b < perRow; b++) {
      const a0 = offset + (b / perRow) * Math.PI * 2 + gapA / 2
      const a1 = offset + ((b + 1) / perRow) * Math.PI * 2 - gapA / 2
      const am = (a0 + a1) / 2
      const ro = rOut + (r() - 0.5) * 0.016
      c.set(BRICKS[Math.floor(r() * BRICKS.length)]).multiplyScalar(0.95 + r() * 0.08)
      // Outer face (2 segments for a little curvature), top, bottom, sides.
      for (const [s0, s1] of [[a0, am], [am, a1]]) {
        const sm = (s0 + s1) / 2
        quad(P(ro, s0, y0), P(ro, s1, y0), P(ro, s1, y1), P(ro, s0, y1), [Math.cos(sm), 0, Math.sin(sm)])
        quad(P(rIn, s0, y1), P(ro, s0, y1), P(ro, s1, y1), P(rIn, s1, y1), [0, 1, 0])
        quad(P(rIn, s0, y0), P(ro, s0, y0), P(ro, s1, y0), P(rIn, s1, y0), [0, -1, 0])
      }
      quad(P(rIn, a0, y0), P(ro, a0, y0), P(ro, a0, y1), P(rIn, a0, y1), [Math.sin(a0), 0, -Math.cos(a0)])
      quad(P(rIn, a1, y0), P(ro, a1, y0), P(ro, a1, y1), P(rIn, a1, y1), [-Math.sin(a1), 0, Math.cos(a1)])
    }
  }

  const bricks = new BufferGeometry()
  bricks.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  bricks.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
  return build([
    { geo: bricks },
    { geo: new CylinderGeometry(rIn + 0.002, rIn + 0.002, DRUM_H, 18, 1, true), color: MORTAR, pos: [0, DRUM_H / 2, 0] },
  ])
}

/** Wide, slightly tapered stone ring the tower stands on. */
export function makePlinth(): BufferGeometry {
  return build([{ geo: new CylinderGeometry(0.47, 0.5, 0.16, 12), color: '#b8b1a6', pos: [0, 0.08, 0] }])
}

/** A few mossy tufts to break up clean stone tops. */
function moss(r: () => number, count: number, ring: number, y: number): Part[] {
  return Array.from({ length: count }, () => {
    const a = r() * Math.PI * 2
    const s = 0.05 + r() * 0.04
    return {
      geo: new IcosahedronGeometry(1, 0),
      color: MOSS[Math.floor(r() * MOSS.length)],
      pos: [Math.cos(a) * ring, y, Math.sin(a) * ring] as [number, number, number],
      scale: [s * 1.4, s * 0.55, s * 1.4] as [number, number, number],
    }
  })
}

/** Flat stone slab with a low dome, like the cap on a stone tower. */
export function makeTowerCap(): BufferGeometry {
  const r = rng(13)
  return build([
    { geo: new CylinderGeometry(0.49, 0.46, 0.08, 12), color: CAP_STONE, pos: [0, 0.04, 0] },
    { geo: new SphereGeometry(0.43, 12, 3, 0, Math.PI * 2, 0, Math.PI / 2), color: '#e9e5dd', pos: [0, 0.08, 0], scale: [1, 0.3, 1] },
    ...moss(r, 3, 0.36, 0.1),
  ])
}

/** Stone lantern that crowns a full tower: pedestal, glowing lamp, pagoda roof. */
export function makeCrown(): BufferGeometry {
  const r = rng(21)
  const posts: Part[] = [0, 1, 2, 3].map((k) => {
    const a = Math.PI / 4 + (k * Math.PI) / 2
    return {
      geo: new CylinderGeometry(0.025, 0.025, 0.2, 5),
      color: '#d8d2c8',
      pos: [Math.cos(a) * 0.13, 0.37, Math.sin(a) * 0.13] as [number, number, number],
    }
  })
  return build([
    { geo: new CylinderGeometry(0.1, 0.15, 0.22, 8), color: '#d8d2c8', pos: [0, 0.11, 0] },
    { geo: new CylinderGeometry(0.2, 0.2, 0.05, 6), color: CAP_STONE, pos: [0, 0.245, 0] },
    ...posts,
    { geo: new BoxGeometry(0.17, 0.15, 0.17), color: '#ffe3a1', pos: [0, 0.37, 0] },
    { geo: new ConeGeometry(0.36, 0.2, 6), color: '#d4cec4', pos: [0, 0.57, 0] },
    { geo: new ConeGeometry(0.16, 0.12, 6), color: '#dcd6cd', pos: [0, 0.69, 0] },
    { geo: new IcosahedronGeometry(0.055, 1), color: '#e6e1d8', pos: [0, 0.78, 0] },
    ...moss(r, 3, 0.28, 0.51),
  ])
}

/**
 * One drum-high segment of brick wall, one tile long (centre to centre),
 * running along x. Staggered bricks on both faces around a mortar core.
 */
export function makeWallSegment(): BufferGeometry {
  const r = rng(9)
  const rows = 3
  const rowH = DRUM_H / rows
  const half = WALL_THICKNESS / 2
  const brickW = 0.3
  const parts: Part[] = [
    { geo: new BoxGeometry(1, DRUM_H, WALL_THICKNESS - 0.05), color: MORTAR, pos: [0, DRUM_H / 2, 0] },
  ]
  for (let row = 0; row < rows; row++) {
    const y = row * rowH + rowH / 2
    const start = -0.5 - (row % 2) * (brickW / 2)
    for (let x0 = start; x0 < 0.5; x0 += brickW) {
      const a = Math.max(-0.5, x0) + 0.012
      const b = Math.min(0.5, x0 + brickW) - 0.012
      if (b - a < 0.04) continue
      for (const side of [-1, 1]) {
        parts.push({
          geo: new BoxGeometry(b - a, rowH - 0.014, 0.05),
          color: BRICKS[Math.floor(r() * BRICKS.length)],
          pos: [(a + b) / 2, y, side * (half - 0.025 + (r() - 0.5) * 0.008)],
        })
      }
    }
  }
  return build(parts)
}

/** Stone coping along the top of a wall segment. */
export function makeWallCap(): BufferGeometry {
  const r = rng(17)
  return build([
    { geo: new BoxGeometry(1, 0.08, WALL_THICKNESS + 0.08), color: CAP_STONE, pos: [0, 0.04, 0] },
    ...moss(r, 2, 0.2, 0.09),
  ])
}
