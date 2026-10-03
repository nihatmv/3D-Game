import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Vector3 } from 'three'
import { useStoryStore } from '../../store/useStoryStore'
import { findPier } from '../../story/landmarks'
import { QUESTS } from '../../story/quests'
import { ARRIVE_PATH, LAND_SECONDS, landingPath } from '../../story/shipPath'
import { wake } from '../perf'
import { PIER_LENGTH } from './landmarkGeometry'
import { makeShipGeometry } from './shipGeometry'
import { setShipScreen } from '../../ui/story/shipBubble'

const point = new Vector3()
const tangent = new Vector3()
const screen = new Vector3()

/** Height above the waterline the speech bubble points at (mid-sails). */
const BUBBLE_ANCHOR_Y = 1.1

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/** Same swell as the ocean vertex shader, so the ship rides the waves. */
function swell(x: number, z: number, t: number) {
  return (
    (Math.sin(x * 0.35 + t * 0.9) * 0.5 + Math.sin(z * 0.45 - t * 0.7) * 0.35 + Math.sin((x + z) * 0.8 + t * 1.3) * 0.15) *
    0.07
  )
}

/**
 * The visitor's ship: sails in and ties up alongside the pier (landingPath),
 * which stands from the start, then bobs there for the rest of the story.
 * One merged Lambert mesh, no shadow casting, so it never forces a shadow redraw.
 */
export function Ship() {
  const group = useRef<Group>(null)
  const geometry = useMemo(() => makeShipGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const progress = useRef(0)
  const path = useMemo(() => {
    const pier = findPier(useStoryStore.getState().placed, QUESTS)
    return pier ? landingPath(pier.x, pier.z, PIER_LENGTH) : ARRIVE_PATH
  }, [])

  useFrame((state, rawDt) => {
    const g = group.current
    if (!g) return
    // Loose clamp: arrival should take real seconds even at a low frame rate.
    const dt = Math.min(rawDt, 0.25)
    const t = state.clock.elapsedTime
    const story = useStoryStore.getState()

    if (story.shipState === 'arriving') {
      progress.current = Math.min(1, progress.current + dt / LAND_SECONDS)
      if (progress.current >= 1) story.setShipState('docked')
      else wake(200)
    }
    const u = easeInOut(progress.current)
    path.getPointAt(u, point)
    path.getTangentAt(Math.min(u, 0.999), tangent)

    g.position.set(point.x, 0.12 + swell(point.x, point.z, t), point.z)
    g.rotation.set(Math.sin(t * 1.1) * 0.035, Math.atan2(-tangent.z, tangent.x), Math.sin(t * 0.8 + 1) * 0.025, 'YXZ')

    // Tell the captain's speech bubble where the ship is on screen.
    screen.set(point.x, BUBBLE_ANCHOR_Y, point.z).project(state.camera)
    if (screen.z < 1) setShipScreen(((screen.x + 1) / 2) * state.size.width, ((1 - screen.y) / 2) * state.size.height)
  })

  return (
    <group ref={group} position={ARRIVE_PATH.points[0]}>
      <mesh geometry={geometry} raycast={() => null}>
        <meshLambertMaterial vertexColors flatShading />
      </mesh>
    </group>
  )
}
