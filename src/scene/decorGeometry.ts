import { BoxGeometry, BufferGeometry, CylinderGeometry } from 'three'
import { build, type Part } from './geomUtil'

/**
 * Scenery props that aren't landmarks (see decor.ts). The cabin is built in
 * local space with its front (door, porch) facing +z and the ground at y = 0.
 */

const LOG = '#9a6a47'
const LOG_ALT = '#8a5d3e'
const LOG_END = '#d2a37a'
const ROOF = '#6e4b36'
const ROOF_EDGE = '#5a3c2b'
const PLANK = '#bf8b62'
const DOOR = '#5f4030'
const STONE = '#b3aca2'
const STONE_DARK = '#968e84'
const IRON = '#4a4440'

/** Cabin footprint (log walls), wall height and roof rise. */
const W = 1.1
const D = 0.86
const LOG_R = 0.065
const ROWS = 6
const BASE_Y = 0.12
const WALL_TOP = BASE_Y + ROWS * LOG_R * 1.75
const RISE = 0.5

/** Where the chimney's top is, in cabin space: smoke rises from here. */
export const CHIMNEY_TOP: [number, number, number] = [W / 2 - 0.22, WALL_TOP + RISE + 0.3, -D / 4]

/** Windows, in cabin space: centre and outward normal (x, z). Lit separately so they can glow at sunset. */
const WIN_Y = BASE_Y + 0.42
const WINDOWS: Array<{ x: number; z: number; nx: number; nz: number }> = [
  { x: -0.28, z: D / 2 + LOG_R, nx: 0, nz: 1 },
  { x: W / 2 + LOG_R, z: 0.02, nx: 1, nz: 0 },
  { x: -W / 2 - LOG_R, z: 0.02, nx: -1, nz: 0 },
]
const winRot = (w: (typeof WINDOWS)[number]): [number, number, number] => [0, w.nx ? Math.PI / 2 : 0, 0]
const winPos = (w: (typeof WINDOWS)[number], out: number): [number, number, number] => [w.x + w.nx * out, WIN_Y, w.z + w.nz * out]

export function cabinGeometry(): BufferGeometry {
  const parts: Part[] = []

  // Stone footing, a little larger than the walls.
  parts.push({ geo: new BoxGeometry(W + 0.2, BASE_Y, D + 0.16), color: STONE, pos: [0, BASE_Y / 2, 0] })

  // Stacked logs: front/back logs run along x, side logs along z, alternating height
  // like notched corners, with ends poking past the corners.
  for (let k = 0; k < ROWS; k++) {
    const y = BASE_Y + LOG_R + k * LOG_R * 1.75
    const color = k % 2 ? LOG : LOG_ALT
    for (const s of [-1, 1]) {
      parts.push({ geo: new CylinderGeometry(LOG_R, LOG_R, W + 0.18, 6), color, pos: [0, y, (s * D) / 2], rot: [0, 0, Math.PI / 2] })
      parts.push({ geo: new CylinderGeometry(LOG_R, LOG_R, D + 0.18, 6), color, pos: [(s * W) / 2, y + LOG_R * 0.4, 0], rot: [Math.PI / 2, 0, 0] })
    }
  }
  // Pale cut log ends at the four corners.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        geo: new BoxGeometry(0.03, WALL_TOP - BASE_Y, 0.03),
        color: LOG_END,
        pos: [sx * (W / 2 + 0.09), (WALL_TOP + BASE_Y) / 2, sz * (D / 2)],
      })
    }
  }

  // Gable ends: triangles filling the space under the roof, front and back.
  // A 3-sided cylinder turned to face z has its apex up; scale it to the roof's span.
  const tri = (z: number) => ({
    geo: new CylinderGeometry(1, 1, 0.06, 3),
    color: PLANK,
    pos: [0, WALL_TOP + RISE / 3, z] as [number, number, number],
    rot: [-Math.PI / 2, 0, 0] as [number, number, number],
    scale: [W / 2 / 0.866, 1, RISE / 1.5] as [number, number, number],
  })
  parts.push(tri(D / 2), tri(-D / 2))

  // Plank roof: two slabs meeting at the ridge (which runs front to back), with
  // overhang at the sides and out over the porch.
  const half = W / 2 + 0.16
  const slope = Math.atan2(RISE, W / 2)
  const slab = Math.hypot(half, RISE * (half / (W / 2)))
  const roofLen = D + 0.62
  const roofZ = 0.16
  for (const s of [-1, 1]) {
    parts.push({
      geo: new BoxGeometry(slab, 0.07, roofLen),
      color: ROOF,
      pos: [(s * slab * Math.cos(slope)) / 2, WALL_TOP + RISE - (slab * Math.sin(slope)) / 2 + 0.04, roofZ],
      rot: [0, 0, -s * slope],
    })
    // A darker batten along each eave.
    parts.push({
      geo: new BoxGeometry(0.06, 0.06, roofLen + 0.02),
      color: ROOF_EDGE,
      pos: [s * slab * Math.cos(slope), WALL_TOP + RISE - slab * Math.sin(slope) + 0.03, roofZ],
    })
  }
  parts.push({ geo: new BoxGeometry(0.09, 0.08, roofLen + 0.04), color: ROOF_EDGE, pos: [0, WALL_TOP + RISE + 0.06, roofZ] })

  // Stone chimney through the right-hand slope.
  const [cx, cy, cz] = CHIMNEY_TOP
  const ch = cy - BASE_Y
  parts.push({ geo: new BoxGeometry(0.24, ch, 0.24), color: STONE, pos: [cx, BASE_Y + ch / 2, cz] })
  parts.push({ geo: new BoxGeometry(0.3, 0.06, 0.3), color: STONE_DARK, pos: [cx, cy, cz] })

  // Door and its frame.
  const front = D / 2 + LOG_R
  parts.push({ geo: new BoxGeometry(0.3, 0.5, 0.03), color: PLANK, pos: [0.2, BASE_Y + 0.25, front] })
  parts.push({ geo: new BoxGeometry(0.24, 0.45, 0.04), color: DOOR, pos: [0.2, BASE_Y + 0.225, front + 0.01] })
  parts.push({ geo: new BoxGeometry(0.03, 0.03, 0.03), color: IRON, pos: [0.29, BASE_Y + 0.23, front + 0.04] })

  // Window frames and cross bars (the glass is the separate glowing mesh).
  for (const w of WINDOWS) {
    parts.push({ geo: new BoxGeometry(0.25, 0.23, 0.03), color: PLANK, pos: winPos(w, 0.005), rot: winRot(w) })
    parts.push({ geo: new BoxGeometry(0.02, 0.16, 0.02), color: PLANK, pos: winPos(w, 0.04), rot: winRot(w) })
    parts.push({ geo: new BoxGeometry(0.18, 0.02, 0.02), color: PLANK, pos: winPos(w, 0.04), rot: winRot(w) })
  }

  // Porch: a plank deck in front, two posts holding up the roof's overhang, and a step.
  const porchZ = D / 2 + 0.26
  parts.push({ geo: new BoxGeometry(W + 0.12, 0.05, 0.36), color: PLANK, pos: [0, BASE_Y - 0.01, porchZ] })
  parts.push({ geo: new BoxGeometry(0.34, 0.04, 0.14), color: STONE_DARK, pos: [0.2, 0.03, porchZ + 0.24] })
  for (const s of [-1, 1]) {
    const postH = WALL_TOP - BASE_Y + 0.02
    parts.push({ geo: new BoxGeometry(0.06, postH, 0.06), color: LOG, pos: [s * (W / 2 + 0.02), BASE_Y + postH / 2, porchZ + 0.14] })
  }
  // Lantern hook beside the door.
  parts.push({ geo: new BoxGeometry(0.02, 0.02, 0.1), color: IRON, pos: [-0.04, BASE_Y + 0.55, front + 0.05] })

  // A barrel on the porch and a woodpile against the left wall.
  parts.push({ geo: new CylinderGeometry(0.1, 0.09, 0.24, 8), color: LOG, pos: [-W / 2 + 0.12, BASE_Y + 0.14, porchZ + 0.02] })
  parts.push({ geo: new CylinderGeometry(0.105, 0.105, 0.03, 8), color: IRON, pos: [-W / 2 + 0.12, BASE_Y + 0.2, porchZ + 0.02] })
  for (const [x, y] of [[-0.66, 0.05], [-0.76, 0.05], [-0.86, 0.05], [-0.71, 0.13], [-0.81, 0.13]]) {
    parts.push({ geo: new CylinderGeometry(0.05, 0.05, 0.42, 6), color: y > 0.1 ? LOG : LOG_ALT, pos: [x, y, -0.1], rot: [Math.PI / 2, 0, 0] })
  }

  return build(parts)
}

/** The window panes and the lantern: one small mesh whose glow follows the sunset. */
export function cabinLightsGeometry(): BufferGeometry {
  const parts: Part[] = WINDOWS.map((w) => ({ geo: new BoxGeometry(0.18, 0.16, 0.03), pos: winPos(w, 0.02), rot: winRot(w) }))
  // The lantern hanging by the door.
  parts.push({ geo: new BoxGeometry(0.07, 0.09, 0.07), pos: [-0.04, BASE_Y + 0.48, D / 2 + LOG_R + 0.1] })
  return build(parts)
}
