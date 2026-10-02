import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  SphereGeometry,
} from 'three'
import { PIER_DIR, POND_BRIDGE_ENDS } from '../../story/landmarks'
import { QUESTS, type LandmarkKind } from '../../story/quests'
import { build, rng, type Part } from '../geomUtil'
import { makePlantGeometries } from '../plantGeometry'

const WHITE = '#f6f1e7'
const RED = '#e06a50'
const STONE = '#bdb6ac'
const STONE_DARK = '#a59d92'
const DARK = '#5a4a40'
const WOOD = '#a77450'
const WOOD_LIGHT = '#bf8b62'
const WOOD_DARK = '#7a5238'

/** Height of the lighthouse base; the top section starts here. */
export const LIGHTHOUSE_BASE_H = 1.18
const TOP_TOWER_H = 0.85
const GALLERY_H = 0.07
/** Centre of the glowing lamp, relative to the ground. */
export const LAMP_Y = LIGHTHOUSE_BASE_H + TOP_TOWER_H + GALLERY_H + 0.16
export const LAMP_R = 0.2
/** Pier deck height above the sea and its length (it starts at x = 0 and runs along x in PIER_DIR). */
export const PIER_DECK_Y = 0.32
export const PIER_LENGTH = 3.4

/** Door faces the default camera (+x/+z diagonal). */
const FACE = Math.PI / 4

function lighthouseBase(): BufferGeometry {
  const door: [number, number, number] = [Math.cos(FACE) * 0.33, 0.38, Math.sin(FACE) * 0.33]
  return build([
    { geo: new CylinderGeometry(0.46, 0.5, 0.18, 10), color: STONE, pos: [0, 0.09, 0] },
    { geo: new CylinderGeometry(0.3, 0.36, 1.0, 12), color: WHITE, pos: [0, 0.68, 0] },
    { geo: new CylinderGeometry(0.325, 0.345, 0.22, 12), color: RED, pos: [0, 0.62, 0] },
    { geo: new BoxGeometry(0.06, 0.34, 0.2), color: WOOD_DARK, pos: door, rot: [0, -FACE, 0] },
    { geo: new BoxGeometry(0.05, 0.14, 0.1), color: DARK, pos: [Math.cos(FACE) * 0.31, 0.98, Math.sin(FACE) * 0.31], rot: [0, -FACE, 0] },
  ])
}

function lighthouseTop(): BufferGeometry {
  const y0 = LIGHTHOUSE_BASE_H
  const gy = y0 + TOP_TOWER_H
  return build([
    { geo: new CylinderGeometry(0.25, 0.3, TOP_TOWER_H, 12), color: WHITE, pos: [0, y0 + TOP_TOWER_H / 2, 0] },
    { geo: new CylinderGeometry(0.27, 0.29, 0.2, 12), color: RED, pos: [0, y0 + 0.45, 0] },
    { geo: new CylinderGeometry(0.42, 0.4, GALLERY_H, 12), color: DARK, pos: [0, gy + GALLERY_H / 2, 0] },
    // Thin posts around the lamp room.
    ...[0, 1, 2, 3, 4, 5].map(
      (k): Part => ({
        geo: new BoxGeometry(0.03, 0.34, 0.03),
        color: DARK,
        pos: [Math.cos((k * Math.PI) / 3) * 0.23, LAMP_Y, Math.sin((k * Math.PI) / 3) * 0.23],
      }),
    ),
    { geo: new ConeGeometry(0.32, 0.34, 12), color: RED, pos: [0, LAMP_Y + 0.33, 0] },
    { geo: new SphereGeometry(0.05, 6, 4), color: DARK, pos: [0, LAMP_Y + 0.53, 0] },
  ])
}

/** Bank top above the lake's water level (level-2 banks around level-1 water). */
const BANK_Y = 0.2
/** Wooden bridge: span between the abutments and the arch's rise over the bank. */
const BRIDGE_SPAN = 2.7
const BRIDGE_RISE = 0.34
const DECK_W = 0.52

/** Deck height along the span, s in [-SPAN/2, SPAN/2]. */
const deckY = (s: number) => BANK_Y + 0.04 + BRIDGE_RISE * Math.cos((Math.PI * s) / BRIDGE_SPAN)

/** A box stretched between two points of the bridge's side profile (x = along the span). */
function beam(s0: number, y0: number, s1: number, y1: number, z: number, h: number, d: number, color: string): Part {
  return {
    geo: new BoxGeometry(Math.hypot(s1 - s0, y1 - y0) + 0.02, h, d),
    color,
    pos: [(s0 + s1) / 2, (y0 + y1) / 2, z],
    rot: [0, 0, Math.atan2(y1 - y0, s1 - s0)],
  }
}

/** Arched plank bridge along +x, centred on the origin, ground (bank) at y = BANK_Y. */
function bridge(): BufferGeometry {
  const parts: Part[] = []
  const half = BRIDGE_SPAN / 2
  const planks = 11
  const step = BRIDGE_SPAN / planks
  for (let k = 0; k < planks; k++) {
    const s0 = -half + k * step
    parts.push(beam(s0, deckY(s0), s0 + step, deckY(s0 + step), (k % 3) * 0.015 - 0.015, 0.05, DECK_W, k % 2 ? WOOD : WOOD_LIGHT))
  }
  // Side stringers under the deck edges, so the arch reads from the side.
  const segs = 8
  for (let k = 0; k < segs; k++) {
    const s0 = -half + (k * BRIDGE_SPAN) / segs
    const s1 = s0 + BRIDGE_SPAN / segs
    for (const z of [-DECK_W / 2, DECK_W / 2]) parts.push(beam(s0, deckY(s0) - 0.06, s1, deckY(s1) - 0.06, z, 0.09, 0.05, WOOD_DARK))
  }
  // Posts with a handrail following the arch.
  const posts = [-half + 0.1, -half / 2, 0, half / 2, half - 0.1]
  const RAIL_H = 0.26
  for (const z of [-DECK_W / 2 + 0.02, DECK_W / 2 - 0.02]) {
    posts.forEach((s, k) => {
      parts.push({ geo: new BoxGeometry(0.05, RAIL_H, 0.05), color: WOOD_DARK, pos: [s, deckY(s) + RAIL_H / 2, z] })
      parts.push({ geo: new BoxGeometry(0.075, 0.03, 0.075), color: WOOD_LIGHT, pos: [s, deckY(s) + RAIL_H + 0.015, z] })
      if (k > 0) {
        const p = posts[k - 1]
        parts.push(beam(p, deckY(p) + RAIL_H - 0.03, s, deckY(s) + RAIL_H - 0.03, z, 0.035, 0.035, WOOD))
      }
    })
  }
  // Stone abutments on each bank.
  for (const s of [-half, half]) {
    parts.push({ geo: new BoxGeometry(0.36, 0.24, DECK_W + 0.16), color: STONE, pos: [s, BANK_Y + 0.06, 0] })
    parts.push({ geo: new BoxGeometry(0.2, 0.1, 0.24), color: STONE_DARK, pos: [s + Math.sign(s) * 0.2, BANK_Y + 0.02, DECK_W / 2 + 0.04], rot: [0, 0.3, 0] })
  }
  return build(parts)
}

const PAD = ['#6fae63', '#7cbf68', '#86c770']

/** Lily pad: a disc with a wedge cut out. */
function lilyPad(r: () => number, x: number, z: number, size: number): Part {
  return {
    geo: new CylinderGeometry(size, size, 0.02, 10, 1, false, 0.4, Math.PI * 2 - 0.55),
    color: PAD[Math.floor(r() * PAD.length)],
    pos: [x, 0.012, z],
    rot: [0, r() * Math.PI * 2, 0],
  }
}

function lotus(x: number, z: number): Part[] {
  return [
    { geo: new ConeGeometry(0.1, 0.13, 6), color: '#f7a8c4', pos: [x, 0.08, z], rot: [Math.PI, 0, 0] },
    { geo: new ConeGeometry(0.07, 0.1, 5), color: '#fbd0df', pos: [x, 0.1, z], rot: [Math.PI, 0.6, 0] },
    { geo: new SphereGeometry(0.035, 6, 4), color: '#ffe08a', pos: [x, 0.14, z] },
  ]
}

/**
 * The Cue lake, centred on its water tiles (the pond quest's click shape):
 * an arched wooden bridge across its narrow middle, lily pads and lotus in
 * both lobes, reeds and cattails along the far banks and tips, stepping
 * stones in the right lobe. Everything stays on the lake's own (locked)
 * tiles and bridge ends. Positions are tile offsets tuned to that shape.
 */
function pond(): BufferGeometry {
  const q = QUESTS.find((q) => q.landmark === 'pondRipples')!
  const cx = q.clicks.reduce((s, [dx]) => s + dx, 0) / q.clicks.length
  const cz = q.clicks.reduce((s, [, dz]) => s + dz, 0) / q.clicks.length
  /** Local position of a point given as a tile offset from the quest centre. */
  const at = (dx: number, dz: number): [number, number] => [dx - cx, dz - cz]
  const r = rng(7)
  const parts: Part[] = []

  // Bridge between the two bank ends, its centre halfway between them.
  const [e0, e1] = POND_BRIDGE_ENDS
  const [bx, bz] = at((e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2)
  const yaw = Math.atan2(-(e0[1] - e1[1]), e0[0] - e1[0])
  parts.push({ geo: bridge(), pos: [bx, 0, bz], rot: [0, yaw, 0] })

  // Lily pads (offsets in tiles from the quest centre) in the two lobes either side of the bridge, two with a lotus.
  const pads: [number, number, number][] = [
    [-1.1, 1.0, 0.19], [-0.75, 1.28, 0.14], [-1.15, -0.15, 0.17], [-0.8, 0.22, 0.13],
    [0.9, -1.0, 0.18], [1.22, -1.2, 0.14], [0.68, -0.72, 0.12],
  ]
  for (const [dx, dz, size] of pads) parts.push(lilyPad(r, ...at(dx, dz), size))
  parts.push(...lotus(...at(-1.1, 1.0)), ...lotus(...at(0.9, -1.0)))

  // Reeds and cattails in the shallows: along the far banks and at the lake's two tips, never in front.
  const plant = makePlantGeometries()
  const clumps: [number, number, 'reed' | 'cattail', number][] = [
    [-1.4, -0.32, 'cattail', 1.4], [-1.38, 0.12, 'reed', 1.25], [-1.4, 1.36, 'reed', 1.2],
    [0.85, -1.4, 'reed', 1.3], [1.3, -1.38, 'cattail', 1.35], [1.4, -0.85, 'reed', 1.15],
    [-0.42, -0.4, 'cattail', 1.1],
  ]
  for (const [dx, dz, kind, s] of clumps) {
    const [x, z] = at(dx, dz)
    parts.push({ geo: plant[kind].clone(), pos: [x, -0.08, z], scale: [s, s, s], rot: [0, r() * 6, 0] })
  }
  Object.values(plant).forEach((g) => g.dispose())

  // Stepping stones across the right lobe, from the near bank toward the far reeds.
  const steps: [number, number, number][] = [
    [0.85, 0.4, 0.15], [1.15, 0.12, 0.13], [0.95, -0.2, 0.14], [1.22, -0.48, 0.12],
  ]
  steps.forEach(([dx, dz, size], k) => {
    const [x, z] = at(dx, dz)
    parts.push({ geo: new DodecahedronGeometry(size, 0), color: k % 2 ? STONE_DARK : STONE, pos: [x, 0.02, z], scale: [1.15, 0.45, 1], rot: [0, r() * 3, 0] })
  })
  return build(parts)
}

function pier(): BufferGeometry {
  const parts: Part[] = []
  const planks = 10
  const w = PIER_LENGTH / planks
  for (let k = 0; k < planks; k++) {
    parts.push({
      geo: new BoxGeometry(w * 0.88, 0.07, 0.82),
      color: k % 2 ? WOOD : WOOD_LIGHT,
      pos: [PIER_DIR * w * (k + 0.5), PIER_DECK_Y, 0],
      rot: [0, 0, (k % 3) * 0.01 - 0.01],
    })
  }
  for (const x of [0.7, 1.9, PIER_LENGTH - 0.15]) {
    for (const z of [-0.37, 0.37]) {
      parts.push({ geo: new CylinderGeometry(0.06, 0.07, 1.3, 6), color: WOOD_DARK, pos: [PIER_DIR * x, PIER_DECK_Y - 0.55, z] })
    }
  }
  // Lantern post and a bollard at the far end.
  const end = PIER_DIR * (PIER_LENGTH - 0.25)
  parts.push({ geo: new CylinderGeometry(0.035, 0.04, 0.8, 6), color: WOOD_DARK, pos: [end, PIER_DECK_Y + 0.42, 0.3] })
  parts.push({ geo: new BoxGeometry(0.14, 0.16, 0.14), color: '#ffd27a', pos: [end, PIER_DECK_Y + 0.88, 0.3] })
  parts.push({ geo: new ConeGeometry(0.12, 0.08, 4), color: DARK, pos: [end, PIER_DECK_Y + 1.0, 0.3], rot: [0, Math.PI / 4, 0] })
  parts.push({ geo: new CylinderGeometry(0.07, 0.08, 0.18, 8), color: DARK, pos: [end, PIER_DECK_Y + 0.12, -0.28] })
  return build(parts)
}

function bigTree(): BufferGeometry {
  const r = rng(11)
  const parts: Part[] = [
    { geo: new CylinderGeometry(0.12, 0.2, 1.4, 7), color: '#8a5a3b', pos: [0, 0.7, 0] },
    { geo: new CylinderGeometry(0.05, 0.08, 0.6, 5), color: '#8a5a3b', pos: [0.22, 1.25, 0.05], rot: [0, 0, -0.7] },
    { geo: new IcosahedronGeometry(0.85, 0), color: '#6fae63', pos: [0, 1.8, 0] },
    { geo: new IcosahedronGeometry(0.58, 0), color: '#8fcf73', pos: [0.5, 1.45, 0.25] },
    { geo: new IcosahedronGeometry(0.62, 0), color: '#7cbf68', pos: [-0.45, 1.5, -0.25] },
    { geo: new IcosahedronGeometry(0.5, 0), color: '#8fcf73', pos: [0.05, 2.4, 0.05] },
  ]
  // Blossoms dotted over the canopy.
  for (let k = 0; k < 9; k++) {
    const a = r() * Math.PI * 2
    const e = 0.2 + r() * 0.9
    parts.push({
      geo: new IcosahedronGeometry(0.07, 0),
      color: k % 3 ? '#f7a8c4' : '#fff1f5',
      pos: [Math.cos(a) * Math.cos(e) * 0.88, 1.8 + Math.sin(e) * 0.75, Math.sin(a) * Math.cos(e) * 0.88],
    })
  }
  return build(parts)
}

const MAKERS: Record<LandmarkKind, () => BufferGeometry> = {
  lighthouseBase,
  lighthouseTop,
  pondRipples: pond,
  pier,
  bigTree,
}

const cache = new Map<LandmarkKind, BufferGeometry>()

/** Built once per kind and shared (landmarks are never removed). */
export function landmarkGeometry(kind: LandmarkKind): BufferGeometry {
  let g = cache.get(kind)
  if (!g) cache.set(kind, (g = MAKERS[kind]()))
  return g
}
