import { useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { MOUSE, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { HALF } from '../world/constants'

const TARGET_MIN = new Vector3(-HALF + 2, 0.5, -HALF + 2)
const TARGET_MAX = new Vector3(HALF - 2, 0.5, HALF - 2)

/**
 * Right-drag orbits, middle-drag pans, wheel zooms. Left button is left free
 * for the tools. Polar angle is clamped so the camera never dips under water.
 */
export function CameraRig() {
  const ref = useRef<OrbitControlsImpl>(null)

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
