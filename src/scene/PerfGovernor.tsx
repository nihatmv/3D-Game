import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useIslandStore } from '../store/useIslandStore'
import { isAwake, requestShadowUpdate, takeShadowUpdate, wake } from './perf'

const IDLE_FPS = 30

/**
 * Drives the `frameloop="demand"` canvas: full frame rate while the user is
 * interacting (or something called `wake()`), ~30fps otherwise. Also renders
 * the shadow map only when requested instead of every frame.
 */
export function PerfGovernor() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const terrainVersion = useIslandStore((s) => s.terrainVersion)

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    requestShadowUpdate(2)
  }, [gl])

  useEffect(() => {
    requestShadowUpdate()
  }, [terrainVersion])

  useEffect(() => {
    const onInput = () => wake()
    const events = ['pointermove', 'pointerdown', 'wheel', 'keydown'] as const
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }))

    let raf = 0
    let last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const interval = isAwake(t) ? 0 : 1000 / IDLE_FPS - 2
      if (t - last >= interval) {
        last = t
        invalidate()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      events.forEach((e) => window.removeEventListener(e, onInput))
    }
  }, [invalidate])

  // Runs before the render in each frame.
  useFrame(() => {
    if (takeShadowUpdate()) gl.shadowMap.needsUpdate = true
  })

  return null
}
