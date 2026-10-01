import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry } from 'three'
import type { LandmarkKind } from '../../story/quests'
import { build, rng, type Part } from '../geomUtil'

const WHITE = '#f6f1e7'
const RED = '#e06a50'
const STONE = '#bdb6ac'
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
/** Pier deck height above the sea and its length (it starts at x = 0 and runs along +x). */
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

function pond(): BufferGeometry {
  const r = rng(7)
  const parts: Part[] = []
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r()
    const d = 0.35 + r() * 0.35
    parts.push({
      geo: new CylinderGeometry(0.17 + r() * 0.06, 0.17, 0.02, 9),
      color: k % 2 ? '#7cbf68' : '#6fae63',
      pos: [Math.cos(a) * d, 0.01, Math.sin(a) * d],
    })
  }
  // A lotus flower on a pad.
  const a0 = 0.4
  parts.push({ geo: new ConeGeometry(0.09, 0.12, 6), color: '#f7a8c4', pos: [Math.cos(a0) * 0.5, 0.08, Math.sin(a0) * 0.5], rot: [Math.PI, 0, 0] })
  parts.push({ geo: new SphereGeometry(0.035, 6, 4), color: '#ffe08a', pos: [Math.cos(a0) * 0.5, 0.12, Math.sin(a0) * 0.5] })
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
      pos: [w * (k + 0.5), PIER_DECK_Y, 0],
      rot: [0, 0, (k % 3) * 0.01 - 0.01],
    })
  }
  for (const x of [0.7, 1.9, PIER_LENGTH - 0.15]) {
    for (const z of [-0.37, 0.37]) {
      parts.push({ geo: new CylinderGeometry(0.06, 0.07, 1.3, 6), color: WOOD_DARK, pos: [x, PIER_DECK_Y - 0.55, z] })
    }
  }
  // Lantern post and a bollard at the far end.
  const end = PIER_LENGTH - 0.25
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
