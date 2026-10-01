import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, Group, Vector3 } from 'three'
import { useStoryStore } from '../../store/useStoryStore'
import { findPier } from '../../story/landmarks'
import { QUESTS } from '../../story/quests'
import { ARRIVE_PATH, ARRIVE_SECONDS, DOCK_SECONDS, dockPath } from '../../story/shipPath'
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

/** One stretch of sailing: a path, how long it takes, and the state it ends in. */
type Leg = { path: CatmullRomCurve3; seconds: number; then: 'waiting' | 'docked' }

/**
 * The visitor's ship: sails in along ARRIVE_PATH, bobs at anchor, then docks
 * alongside the pier at the end of the story.
 * One merged Lambert mesh, no shadow casting, so it never forces a shadow redraw.
 */
export function Ship() {
  const group = useRef<Group>(null)
  const geometry = useMemo(() => makeShipGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const progress = useRef(0)
  const leg = useRef<Leg>({ path: ARRIVE_PATH, seconds: ARRIVE_SECONDS, then: 'waiting' })

  useFrame((state, rawDt) => {
    const g = group.current
    if (!g) return
    // Loose clamp: arrival should take real seconds even at a low frame rate.
    const dt = Math.min(rawDt, 0.25)
    const t = state.clock.elapsedTime
    const story = useStoryStore.getState()

    if (story.shipState === 'docking' && leg.current.then !== 'docked') {
      const pier = findPier(story.placed, QUESTS)
      const from = g.position.clone()
      leg.current = {
        path: pier ? dockPath(from, pier.x, pier.z, PIER_LENGTH) : new CatmullRomCurve3([from, from.clone().setX(from.x - 0.01)]),
        seconds: DOCK_SECONDS,
        then: 'docked',
      }
      progress.current = 0
    }
    const moving = story.shipState === 'arriving' || story.shipState === 'docking'
    if (moving) {
      progress.current = Math.min(1, progress.current + dt / leg.current.seconds)
      if (progress.current >= 1) story.setShipState(leg.current.then)
      else wake(200)
    }
    const { path } = leg.current
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
