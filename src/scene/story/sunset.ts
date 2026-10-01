/**
 * Current sunset blend (0 = day, 1 = golden hour), eased toward the story
 * store's target by <Lighting/>. Plain module state so shaders can read it
 * every frame without React re-renders.
 */
export const sunset = { t: 0 }

/** Golden-hour colours the day palette blends toward. */
export const SUNSET_PALETTE = {
  sky: '#f7c08e',
  sun: '#ffd0a0',
  hemiSky: '#ffe0bd',
  hemiGround: '#b9b4c8',
  deepWater: '#4f9fb4',
  water: '#e8cfa6',
  foam: '#fff1de',
}
