import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Euler, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three'
import { isTourActive } from '../../store/useStoryStore'
import { CREW_SIZE, crew, crewVersion, scrubCrew, stepCrew, stepParty } from '../../story/crew'
import { scroll } from '../../story/scroll'
import { wake } from '../perf'
import { HAND, captainHatGeometry, crewClothGeometry, crewFixedGeometry, hammerGeometry } from './crewGeometry'

/** Shirt and headscarf colour per mate; the captain (first) wears his red coat. */
const CLOTH = ['#8e2f26', '#e9e2d6', '#5b8fb0', '#e0a94f', '#6f9d6a', '#c9705a']
/** Scale per mate: big enough to read from the home view; the captain stands a little taller than his men. */
const SIZE = [1.18, 1, 0.94, 1.04, 0.97, 1.02].map((s) => s * 1.45)

const _m = new Matrix4()
const _h = new Matrix4()
const _q = new Quaternion()
const _e = new Euler()
const _p = new Vector3()
const _s = new Vector3()
const _c = new Color()
const _hand = new Vector3(...HAND)
const _one = new Vector3(1, 1, 1)
const HIDDEN = new Matrix4().makeScale(0, 0, 0)

/**
 * The captain and his five men (story/crew.ts): they step off the ship, walk
 * to each building site and hammer there, all with the scroll, then stroll the
 * finished island. Four draw calls (three instanced, plus the captain's hat),
 * Lambert, no shadows, and nothing is redrawn while they stand still.
 */
export function Crew() {
  const fixed = useRef<InstancedMesh>(null)
  const cloth = useRef<InstancedMesh>(null)
  const hammers = useRef<InstancedMesh>(null)
  const hat = useRef<Mesh>(null)
  const geo = useMemo(
    () => ({ fixed: crewFixedGeometry(), cloth: crewClothGeometry(), hat: captainHatGeometry(), hammer: hammerGeometry() }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  useEffect(() => {
    const c = cloth.current
    if (!c) return
    CLOTH.forEach((hex, k) => c.setColorAt(k, _c.set(hex)))
    if (c.instanceColor) c.instanceColor.needsUpdate = true
  }, [])

  const drawn = useRef(0)
  useFrame((_, rawDt) => {
    // The tour puts them where the scroll is; after it they move on their own.
    const dt = Math.min(rawDt, 0.25)
    if (isTourActive()) {
      scrubCrew(scroll.value)
      if (stepParty(dt)) wake(200)
    } else if (crewVersion > 0 && stepCrew(dt)) wake(200)
    // Version 0: nobody has been placed yet.
    if (crewVersion === 0) return
    if (drawn.current === crewVersion) return
    drawn.current = crewVersion

    const f = fixed.current
    const c = cloth.current
    const t = hammers.current
    const h = hat.current
    if (!f || !c || !t || !h) return
    crew.forEach((m, k) => {
      // A hop per step, leaning into the walk; a jump when cheering; a bow into each hammer blow.
      const swing = Math.sin(m.cycle)
      const hop = m.walking ? Math.abs(swing) * 0.055 : m.cheering ? Math.abs(swing) * 0.16 : 0
      const lean = m.walking ? 0.16 : m.working ? 0.14 + 0.12 * swing : 0
      _p.set(m.x, m.y + hop, m.z)
      _q.setFromEuler(_e.set(lean, m.heading, m.walking ? swing * 0.07 : 0, 'YXZ'))
      _s.setScalar(Math.max(0.0001, m.shown * SIZE[k]))
      _m.compose(_p, _q, _s)
      f.setMatrixAt(k, _m)
      c.setMatrixAt(k, _m)
      if (k === 0) {
        h.position.copy(_p)
        h.quaternion.copy(_q)
        h.scale.copy(_s)
        return
      }
      // The hammer swings from the hand: back over the shoulder, then down in front.
      if (m.working) {
        _q.setFromEuler(_e.set(0.75 + 0.95 * swing, 0, 0))
        t.setMatrixAt(k - 1, _h.compose(_hand, _q, _one).premultiply(_m))
      } else {
        t.setMatrixAt(k - 1, HIDDEN)
      }
    })
    f.instanceMatrix.needsUpdate = true
    c.instanceMatrix.needsUpdate = true
    t.instanceMatrix.needsUpdate = true
    f.visible = c.visible = t.visible = h.visible = true
  })

  return (
    <>
      <instancedMesh ref={fixed} args={[geo.fixed, undefined, CREW_SIZE]} visible={false} frustumCulled={false} raycast={() => null}>
        <meshLambertMaterial vertexColors flatShading />
      </instancedMesh>
      <instancedMesh ref={cloth} args={[geo.cloth, undefined, CREW_SIZE]} visible={false} frustumCulled={false} raycast={() => null}>
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={hammers} args={[geo.hammer, undefined, CREW_SIZE - 1]} visible={false} frustumCulled={false} raycast={() => null}>
        <meshLambertMaterial vertexColors flatShading />
      </instancedMesh>
      <mesh ref={hat} geometry={geo.hat} visible={false} raycast={() => null}>
        <meshLambertMaterial vertexColors flatShading />
      </mesh>
    </>
  )
}
