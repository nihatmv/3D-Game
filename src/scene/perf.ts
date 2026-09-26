/**
 * Small performance helpers shared by scene components.
 *
 * - Shadows are rendered on demand: call `requestShadowUpdate()` whenever
 *   something that casts shadows changes (terrain, stones, growing plants).
 * - Rendering runs at full rate while the user interacts or something animates,
 *   and drops to ~30fps when idle. Call `wake()` to keep it at full rate.
 */

let shadowFrames = 2
let awakeUntil = 0

export function requestShadowUpdate(frames = 1) {
  shadowFrames = Math.max(shadowFrames, frames)
}

/** Consume one pending shadow update; returns true if the map should re-render. */
export function takeShadowUpdate(): boolean {
  if (shadowFrames <= 0) return false
  shadowFrames--
  return true
}

export function wake(ms = 1500) {
  awakeUntil = Math.max(awakeUntil, performance.now() + ms)
}

export function isAwake(now: number) {
  return now < awakeUntil
}
