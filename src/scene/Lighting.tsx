import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, DirectionalLight, Fog, HemisphereLight, Vector3 } from 'three'
import { useStoryStore } from '../store/useStoryStore'
import { PALETTE } from '../world/constants'
import { requestShadowUpdate, wake } from './perf'
import { SUNSET_PALETTE, sunset } from './story/sunset'

const SUNSET_SECONDS = 5
const SUN_DAY = new Vector3(14, 24, 9)
const SUN_LOW = new Vector3(24, 13, 4)

const smooth = (t: number) => t * t * (3 - 2 * t)

/**
 * Sky, fog, and the two lights. When the story asks for a sunset, everything
 * eases to golden hour once; no extra lights or passes are added.
 */
export function Lighting() {
  const scene = useThree((s) => s.scene)
  const hemi = useRef<HemisphereLight>(null)
  const sun = useRef<DirectionalLight>(null)
  const c = useMemo(
    () => ({
      skyDay: new Color(PALETTE.sky),
      skyEve: new Color(SUNSET_PALETTE.sky),
      sunDay: new Color(PALETTE.sun),
      sunEve: new Color(SUNSET_PALETTE.sun),
      hemiSkyEve: new Color(SUNSET_PALETTE.hemiSky),
      groundDay: new Color(PALETTE.ground),
      groundEve: new Color(SUNSET_PALETTE.hemiGround),
    }),
    [],
  )
  const frame = useRef(0)

  useFrame((_, rawDt) => {
    const target = useStoryStore.getState().sunset
    if (sunset.t === target) return
    const dt = Math.min(rawDt, 0.25)
    const step = dt / SUNSET_SECONDS
    sunset.t = target > sunset.t ? Math.min(target, sunset.t + step) : Math.max(target, sunset.t - step)
    const k = smooth(sunset.t)

    if (scene.background instanceof Color) scene.background.lerpColors(c.skyDay, c.skyEve, k)
    if (scene.fog instanceof Fog) scene.fog.color.lerpColors(c.skyDay, c.skyEve, k)
    if (hemi.current) {
      hemi.current.color.lerpColors(c.sunDay, c.hemiSkyEve, k)
      hemi.current.groundColor.lerpColors(c.groundDay, c.groundEve, k)
      hemi.current.intensity = 1.35 + 0.05 * k
    }
    if (sun.current) {
      sun.current.color.lerpColors(c.sunDay, c.sunEve, k)
      sun.current.intensity = 2.1 + 0.1 * k
      sun.current.position.lerpVectors(SUN_DAY, SUN_LOW, k)
    }
    wake(300)
    // The sun moves, so shadows need refreshing, but a few times a second is plenty.
    if (frame.current++ % 6 === 0 || sunset.t === target) requestShadowUpdate()
  })

  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <fog attach="fog" args={[PALETTE.sky, 45, 120]} />

      <hemisphereLight ref={hemi} args={[PALETTE.sun, PALETTE.ground, 1.35]} />
      <directionalLight
        ref={sun}
        position={SUN_DAY.toArray()}
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
