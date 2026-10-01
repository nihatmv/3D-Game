import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MOUSE, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { HALF } from '../world/constants'

const TARGET_MIN = new Vector3(-HALF + 2, 0.5, -HALF + 2)
const TARGET_MAX = new Vector3(HALF - 2, 0.5, HALF - 2)
/** Fraction of the screen height the view is shifted (bottom UI takes the lower part). */
const VIEW_SHIFT = 0.12

/**
 * Right-drag orbits, middle-drag pans, wheel zooms. Left button is left free
 * for the tools. Polar angle is clamped so the camera never dips under water.
 */
export function CameraRig() {
  const ref = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const { width, height } = useThree((s) => s.size)

  // Shift the rendered view down so the island sits above the dialogue and toolbar.
  useEffect(() => {
    camera.setViewOffset(width, height, 0, Math.round(height * VIEW_SHIFT), width, height)
    camera.updateProjectionMatrix()
  }, [camera, width, height])

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={[0, 0.5, 0]}
      enableDamping
      dampingFactor={0.08}
      minDistance={10}
      maxDistance={55}
      minPolarAngle={0.25}
      maxPolarAngle={1.2}
      screenSpacePanning={false}
      mouseButtons={{
        LEFT: -1 as MOUSE,
        MIDDLE: MOUSE.PAN,
        RIGHT: MOUSE.ROTATE,
      }}
      onChange={() => {
        const c = ref.current
        if (c) c.target.clamp(TARGET_MIN, TARGET_MAX)
      }}
    />
  )
}
