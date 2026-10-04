import { CatmullRomCurve3, Vector3 } from 'three'
import { PIER_DIR } from './landmarks'

/**
 * Where the ship sails, in world space (the island is centred on the origin;
 * the default camera sits at +x +z, so -x is the top-left of the screen and
 * the pier quest builds out that way, see PIER_DIR).
 */

/**
 * In from the top-left corner of the default view toward the island's
 * top-left (west) shore, where the pier is.
 */
export const ARRIVE_PATH = new CatmullRomCurve3([
  new Vector3(-38, 0, -9),
  new Vector3(-27, 0, -4.5),
  new Vector3(-19, 0, -1.8),
])

export const LAND_SECONDS = 4.5
/**
 * Offset from the pier's centre line to the ship's, so the hull lies alongside.
 * Negative = the far side from the default camera, so the pier stays in view.
 */
const ALONGSIDE = -1.2

/**
 * The whole landing in one stretch: in along ARRIVE_PATH, then to a berth alongside
 * the end of the pier (`pierX` is where the deck leaves the shore, `length` how far
 * it reaches in PIER_DIR).
 */
export function landingPath(pierX: number, pierZ: number, length: number): CatmullRomCurve3 {
  const end = pierX + PIER_DIR * length
  const z = pierZ + ALONGSIDE
  return new CatmullRomCurve3([
    ...ARRIVE_PATH.points,
    new Vector3(end + PIER_DIR * 2.4, 0, z - 0.35),
    new Vector3(end - PIER_DIR * 0.7, 0, z),
  ])
}
