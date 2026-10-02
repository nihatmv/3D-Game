import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, DirectionalLight, Fog, HemisphereLight } from 'three'
import { useStoryStore } from '../store/useStoryStore'
import { PALETTE } from '../world/constants'
import { requestShadowUpdate, wake } from './perf'
import { setTodHour, tod } from './timeOfDay'

/** The ending's sunset: hours per second, so day → golden hour takes about 5 s. */
const SLOW_RATE = 1.1
/** How fast the light follows the timeline while it's dragged. */
const FOLLOW = 10
const LIGHT_DISTANCE = 29

/**
 * Sky, fog, and the two lights, set from the time of day (timeOfDay.ts).
 * The timeline is followed quickly; the ending eases into golden hour. The
 * directional light is the sun by day and the moon by night; no extra lights
 * or passes are added.
 */
export function Lighting() {
  const scene = useThree((s) => s.scene)
  const hemi = useRef<HemisphereLight>(null)
  const sun = useRef<DirectionalLight>(null)
  const frame = useRef(0)
  const applied = useRef(-1)

  useFrame((_, rawDt) => {
    const { hour: target, hourSlow } = useStoryStore.getState()
    if (tod.hour === target && applied.current === tod.version) return
    if (tod.hour !== target) {
      const dt = Math.min(rawDt, 0.25)
      const diff = target - tod.hour
      const step = hourSlow ? Math.sign(diff) * Math.min(Math.abs(diff), SLOW_RATE * dt) : diff * (1 - Math.exp(-FOLLOW * dt))
      setTodHour(Math.abs(diff - step) < 0.005 ? target : tod.hour + step)
    }
    applied.current = tod.version

    if (scene.background instanceof Color) scene.background.copy(tod.sky)
    if (scene.fog instanceof Fog) scene.fog.color.copy(tod.sky)
    if (hemi.current) {
      hemi.current.color.copy(tod.hemiSky)
      hemi.current.groundColor.copy(tod.hemiGround)
      hemi.current.intensity = tod.hemiI
    }
    if (sun.current) {
      sun.current.color.copy(tod.light)
      sun.current.intensity = tod.lightI
      sun.current.position.copy(tod.lightDir).multiplyScalar(LIGHT_DISTANCE)
    }
    wake(300)
    // The light moves, so shadows need refreshing, but a few times a second is plenty.
    if (frame.current++ % 6 === 0 || tod.hour === target) requestShadowUpdate()
  })

  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <fog attach="fog" args={[PALETTE.sky, 45, 120]} />

      <hemisphereLight ref={hemi} args={[PALETTE.sun, PALETTE.ground, 1.35]} />
      <directionalLight
        ref={sun}
        position={tod.lightDir.clone().multiplyScalar(LIGHT_DISTANCE).toArray()}
        intensity={2.1}
        color={PALETTE.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  )
}
