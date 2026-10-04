import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MOUSE, MathUtils, PerspectiveCamera, TOUCH, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { HALF, topY } from '../world/constants'
import { heightAt } from '../world/grid'
import { useIslandStore } from '../store/useIslandStore'
import { isTourActive, useStoryStore } from '../store/useStoryStore'
import type { Placement } from '../story/landmarks'
import { FLY_MS } from '../story/useTourDirector'
import { wake } from './perf'

const TARGET_MIN = new Vector3(-HALF + 2, 0.5, -HALF + 2)
const TARGET_MAX = new Vector3(HALF - 2, 0.5, HALF - 2)
/**
 * Fraction of the screen height the view is shifted. Small screens keep the
 * captain above the toolbar, so the island moves up; wide screens have the
 * captain beside the ship (see Dialogue's BESIDE_SHIP) and need little room.
 */
const viewShift = (w: number, h: number) => (w >= 900 && h > 500 ? 0.03 : 0.12)
/**
 * The home view: what the camera looks at, and where it sits relative to that.
 * The target is a little toward the back (−z) so the highland fits in frame.
 */
export const HOME_TARGET = new Vector3(2.4, 0.5, -2.4)
const START = new Vector3(20, 17, 20).multiplyScalar(1.05)
export const HOME_POSITION = HOME_TARGET.clone().add(START)
const BASE_DISTANCE = START.length()

/** Narrow (portrait) screens step back so the whole island fits across. */
function fitDistance(aspect: number) {
  return BASE_DISTANCE * Math.min(2.1, Math.max(1, 1.25 / aspect))
}

/** Phones show cards as a bottom sheet (Story.css breakpoint); wider screens put them centre-right. */
const SHEET_MAX_WIDTH = 640

type Pose = { pos: Vector3; target: Vector3 }
type Flight = { from: Pose; to: Pose; start: number }

const UP = new Vector3(0, 1, 0)
/** How far the camera stays above the ground (or sea) under it when tilted low. */
const GROUND_CLEARANCE = 1.4

/** Highest ground around a world point, so a low camera can't sink into a hill. */
function groundBelow(wx: number, wz: number) {
  const { height } = useIslandStore.getState()
  const x = Math.floor(wx + HALF)
  const z = Math.floor(wz + HALF)
  let level = 0
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) level = Math.max(level, heightAt(height, x + dx, z + dz))
  return Math.max(0, topY(level))
}
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * Close-up of a landmark from the same angle as `home`, framed so the card
 * doesn't cover it: left of centre on wide screens (card centre-right), high
 * on phones (card as a bottom sheet), centred when no card is open. The target stays on the controls'
 * y = 0.5 plane, so framing moves it sideways or toward the camera.
 */
function focusPose(at: Placement, home: Pose, camera: PerspectiveCamera, width: number, height: number, card: boolean): Pose {
  const dir = home.pos.clone().sub(home.target).normalize()
  const fwd = new Vector3(-dir.x, 0, -dir.z).normalize()
  const right = new Vector3().crossVectors(fwd, UP).normalize()
  const sheet = width <= SHEET_MAX_WIDTH
  const dist = sheet ? 21 : 17
  const visH = 2 * dist * Math.tan(MathUtils.degToRad(camera.fov / 2))
  const target = new Vector3(at.x, 0.5, at.z)
  if (!card) {
    // Nothing to make room for (the ending's sunset at the cabin): keep it in the middle.
  } else if (sheet) target.addScaledVector(fwd, (-0.2 * visH) / Math.max(0.3, dir.y))
  else target.addScaledVector(right, 0.2 * visH * (width / height))
  target.clamp(TARGET_MIN, TARGET_MAX)
  return { pos: target.clone().addScaledVector(dir, dist), target }
}

/**
 * Right-drag orbits, middle-drag pans, wheel zooms. Left button is left free
 * for the tools. On touch, one finger is for the tools and two fingers turn and
 * zoom. Polar angle is clamped just above the horizon, low enough to look up
 * at the sun or moon but never under water.
 * Locked during the tour (the framing is fixed); free play unlocks it.
 * When the story sets `focus`, it flies to that landmark (FLY_MS) and back home after.
 */
export function CameraRig() {
  const ref = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const { width, height } = useThree((s) => s.size)
  const fitted = useRef(BASE_DISTANCE)
  const distance = fitDistance(width / height)
  const touring = useStoryStore((s) => isTourActive(s))
  const focus = useStoryStore((s) => s.focus)
  const home = useRef<Pose | null>(null)
  const flight = useRef<Flight | null>(null)

  // Fly to the focused landmark, or back to where the visitor was looking before.
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const now: Pose = { pos: camera.position.clone(), target: c.target.clone() }
    // Remember home only when leaving it (not mid-flight, not when hopping between landmarks).
    if (focus && !home.current) home.current = flight.current ? flight.current.to : now
    const to = focus
      ? focusPose(focus, home.current!, camera as PerspectiveCamera, width, height, useStoryStore.getState().openCard !== null)
      : home.current
    if (!focus) home.current = null
    if (!to) return
    flight.current = { from: now, to, start: performance.now() }
    wake(FLY_MS + 200)
    // Only a focus change starts a flight; resizing mid-card keeps the current framing.
  }, [focus, camera])

  useFrame(() => {
    const f = flight.current
    const c = ref.current
    if (!f || !c) return
    const k = Math.min(1, (performance.now() - f.start) / FLY_MS)
    const e = easeInOutCubic(k)
    camera.position.lerpVectors(f.from.pos, f.to.pos, e)
    c.target.lerpVectors(f.from.target, f.to.target, e)
    c.update()
    wake(200)
    if (k >= 1) flight.current = null
  })

  // Re-frame when the screen shape changes a lot (phone rotated), not on small resizes.
  useEffect(() => {
    const c = ref.current
    if (!c || Math.abs(distance - fitted.current) / fitted.current < 0.05) return
    fitted.current = distance
    const offset = camera.position.clone().sub(c.target)
    camera.position.copy(c.target).add(offset.setLength(distance))
    c.update()
  }, [camera, distance])

  // Dev-only handle for headless tests (project world points to the screen).
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { camera: typeof camera }).camera = camera
  }, [camera])

  // Shift the rendered view down so the island sits above the dialogue and toolbar.
  useEffect(() => {
    camera.setViewOffset(width, height, 0, Math.round(height * viewShift(width, height)), width, height)
    camera.updateProjectionMatrix()
  }, [camera, width, height])

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enabled={!touring && !focus}
      target={HOME_TARGET.toArray()}
      enableDamping
      dampingFactor={0.08}
      minDistance={10}
      maxDistance={Math.max(55, distance * 1.15)}
      minPolarAngle={0.25}
      maxPolarAngle={1.47}
      screenSpacePanning={false}
      mouseButtons={{
        LEFT: -1 as MOUSE,
        MIDDLE: MOUSE.PAN,
        RIGHT: MOUSE.ROTATE,
      }}
      touches={{ ONE: -1 as TOUCH, TWO: TOUCH.DOLLY_ROTATE }}
      onChange={() => {
        const c = ref.current
        if (!c) return
        c.target.clamp(TARGET_MIN, TARGET_MAX)
        const floor = groundBelow(camera.position.x, camera.position.z) + GROUND_CLEARANCE
        if (camera.position.y < floor) camera.position.y = floor
      }}
    />
  )
}
