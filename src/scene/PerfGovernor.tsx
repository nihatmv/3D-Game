import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useIslandStore } from '../store/useIslandStore'
import { isAwake, requestShadowUpdate, setLowPower, takeShadowUpdate, wake } from './perf'

const IDLE_FPS = 30

// Retina screens get at most 1.5x; the sampler lowers this further on slow GPUs.
export const MAX_DPR = Math.min(window.devicePixelRatio, 1.5)
const MIN_DPR = 0.75

// Frame rate sampler: SAMPLES windows of SAMPLE_MS each, then one verdict.
const SAMPLE_MS = 250
const SAMPLES = 10
const SLOW_FPS = 45
const FAST_FPS = 58
const VERDICT = 0.75
const STEP = 0.1

/**
 * Drives the `frameloop="demand"` canvas: full frame rate while the user is
 * interacting (or something called `wake()`), ~30fps otherwise. Also renders
 * the shadow map only when requested instead of every frame.
 *
 * It also measures the frame rate and lowers the resolution (then turns off
 * optional eye candy) on slow GPUs. Only awake frames are measured: the idle
 * 30fps is on purpose and must not read as a slow machine.
 */
export function PerfGovernor() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const setDpr = useThree((s) => s.setDpr)
  const sampler = useRef({ start: 0, frames: 0, fps: [] as number[], factor: 0.5 })
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

    const s = sampler.current
    const now = performance.now()
    if (!isAwake(now)) {
      s.frames = 0
      return
    }
    if (s.frames++ === 0) {
      s.start = now
      return
    }
    const passed = now - s.start
    if (passed < SAMPLE_MS) return
    s.fps.push(((s.frames - 1) / passed) * 1000)
    s.frames = 0
    if (s.fps.length < SAMPLES) return

    const slow = s.fps.filter((f) => f < SLOW_FPS).length
    const fast = s.fps.filter((f) => f >= FAST_FPS).length
    s.fps.length = 0
    const before = s.factor
    if (fast > SAMPLES * VERDICT) s.factor = Math.min(1, s.factor + STEP)
    if (slow > SAMPLES * VERDICT) s.factor = Math.max(0, s.factor - STEP)
    if (s.factor === before) return
    setDpr(Math.round((MIN_DPR + (MAX_DPR - MIN_DPR) * s.factor) * 20) / 20)
    setLowPower(s.factor < 0.35)
  })

  return null
}
