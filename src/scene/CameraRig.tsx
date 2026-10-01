import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MOUSE, TOUCH, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { HALF } from '../world/constants'
import { isTourActive, useStoryStore } from '../store/useStoryStore'

const TARGET_MIN = new Vector3(-HALF + 2, 0.5, -HALF + 2)
const TARGET_MAX = new Vector3(HALF - 2, 0.5, HALF - 2)
/**
 * Fraction of the screen height the view is shifted. Small screens keep the
 * captain above the toolbar, so the island moves up; wide screens have the
 * captain beside the ship (see Dialogue's BESIDE_SHIP) and need little room.
 */
const viewShift = (w: number, h: number) => (w >= 900 && h > 500 ? 0.03 : 0.12)
/** Distance of the starting camera from the island centre. */
const START = new Vector3(20, 17, 20)
const BASE_DISTANCE = START.length()

/** Narrow (portrait) screens step back so the whole island fits across. */
function fitDistance(aspect: number) {
  return BASE_DISTANCE * Math.min(1.7, Math.max(1, 1.2 / aspect))
}

/**
 * Right-drag orbits, middle-drag pans, wheel zooms. Left button is left free
 * for the tools. On touch, one finger is for the tools and two fingers turn and
 * zoom. Polar angle is clamped so the camera never dips under water.
 * Locked during the tour (the framing is fixed); free play unlocks it.
 */
export function CameraRig() {
  const ref = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const { width, height } = useThree((s) => s.size)
  const fitted = useRef(BASE_DISTANCE)
  const distance = fitDistance(width / height)
  const touring = useStoryStore((s) => isTourActive(s))

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
      enabled={!touring}
      target={[0, 0.5, 0]}
      enableDamping
      dampingFactor={0.08}
      minDistance={10}
      maxDistance={Math.max(55, distance * 1.15)}
      minPolarAngle={0.25}
      maxPolarAngle={1.2}
      screenSpacePanning={false}
      mouseButtons={{
        LEFT: -1 as MOUSE,
        MIDDLE: MOUSE.PAN,
        RIGHT: MOUSE.ROTATE,
      }}
      touches={{ ONE: -1 as TOUCH, TWO: TOUCH.DOLLY_ROTATE }}
      onChange={() => {
        const c = ref.current
        if (c) c.target.clamp(TARGET_MIN, TARGET_MAX)
      }}
    />
  )
}
