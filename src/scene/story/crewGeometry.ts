import { BoxGeometry, BufferGeometry } from 'three'
import { build, type Part } from '../geomUtil'

/**
 * A blocky little sailor, about half a tile tall, feet at y = 0, facing +z.
 * Split in two so the men can share draw calls and still wear different colours:
 * `fixed` keeps its vertex colours (skin, trousers, boots); `cloth` is white and
 * takes each instance's colour (shirt and headscarf). The captain adds a hat.
 */

const SKIN = '#e8b990'
const TROUSERS = '#3d4a63'
const BOOT = '#2b211b'
const EYE = '#2a1c15'

export function crewFixedGeometry(): BufferGeometry {
  const parts: Part[] = []
  for (const side of [-1, 1]) {
    parts.push({ geo: new BoxGeometry(0.075, 0.1, 0.085), color: TROUSERS, pos: [side * 0.05, 0.11, 0] })
    parts.push({ geo: new BoxGeometry(0.08, 0.06, 0.11), color: BOOT, pos: [side * 0.05, 0.03, 0.012] })
    // Hands, below the sleeves.
    parts.push({ geo: new BoxGeometry(0.05, 0.05, 0.055), color: SKIN, pos: [side * 0.135, 0.165, 0] })
    parts.push({ geo: new BoxGeometry(0.022, 0.028, 0.01), color: EYE, pos: [side * 0.035, 0.405, 0.071] })
  }
  parts.push({ geo: new BoxGeometry(0.14, 0.13, 0.14), color: SKIN, pos: [0, 0.395, 0] })
  return build(parts)
}

export function crewClothGeometry(): BufferGeometry {
  const parts: Part[] = [
    { geo: new BoxGeometry(0.2, 0.17, 0.125), pos: [0, 0.245, 0] },
    // Headscarf, with a knot at the back.
    { geo: new BoxGeometry(0.152, 0.05, 0.152), pos: [0, 0.455, 0] },
    { geo: new BoxGeometry(0.05, 0.04, 0.04), pos: [0.03, 0.44, -0.09] },
  ]
  for (const side of [-1, 1]) parts.push({ geo: new BoxGeometry(0.055, 0.11, 0.065), pos: [side * 0.135, 0.245, 0] })
  return build(parts)
}

/** The captain's hat: a wide dark brim, a crown and a gold band. Sits on the same head. */
export function captainHatGeometry(): BufferGeometry {
  return build([
    { geo: new BoxGeometry(0.27, 0.03, 0.2), color: '#1f1a1c', pos: [0, 0.485, 0] },
    { geo: new BoxGeometry(0.17, 0.085, 0.13), color: '#1f1a1c', pos: [0, 0.535, 0] },
    { geo: new BoxGeometry(0.175, 0.025, 0.135), color: '#d9a441', pos: [0, 0.51, 0] },
    // Coat tails and gold buttons mark him out from behind and in front.
    { geo: new BoxGeometry(0.21, 0.09, 0.03), color: '#8e2f26', pos: [0, 0.14, -0.065] },
    { geo: new BoxGeometry(0.03, 0.12, 0.01), color: '#d9a441', pos: [0, 0.245, 0.066] },
  ])
}

/** A man's right hand, where the hammer's handle pivots. */
export const HAND: [number, number, number] = [-0.135, 0.165, 0.02]

/** A hammer, handle up from the origin (the hand). */
export function hammerGeometry(): BufferGeometry {
  return build([
    { geo: new BoxGeometry(0.028, 0.19, 0.028), color: '#8a5a3b', pos: [0, 0.085, 0] },
    { geo: new BoxGeometry(0.06, 0.06, 0.12), color: '#6f6b68', pos: [0, 0.19, 0.01] },
  ])
}
