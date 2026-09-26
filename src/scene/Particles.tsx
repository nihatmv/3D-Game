import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, IcosahedronGeometry, InstancedMesh, Object3D } from 'three'
import { PUFFS, drainEmits } from './puffs'
import { wake } from './perf'

const POOL = 240
const dummy = new Object3D()
const color = new Color()
const rand = (a: number, b: number) => a + Math.random() * (b - a)

/**
 * Pooled particle puffs: one instanced mesh, fixed-size typed arrays, no
 * allocation per particle. Particles pop in, then shrink out over their life.
 */
export function Particles() {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new IcosahedronGeometry(1, 0), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  const s = useMemo(
    () => ({
      p: new Float32Array(POOL * 3),
      v: new Float32Array(POOL * 3),
      age: new Float32Array(POOL),
      life: new Float32Array(POOL).fill(0),
      size: new Float32Array(POOL),
      gravity: new Float32Array(POOL),
      next: 0,
      active: 0,
    }),
    [],
  )

  useFrame((_, rawDt) => {
    const m = mesh.current
    if (!m) return
    const dt = Math.min(rawDt, 0.05)

    // Spawn queued puffs into the ring buffer.
    for (const e of drainEmits()) {
      const cfg = PUFFS[e.kind]
      const n = e.count ?? cfg.count
      for (let k = 0; k < n; k++) {
        const i = s.next
        s.next = (s.next + 1) % POOL
        const a = Math.random() * Math.PI * 2
        const sp = Math.random() * cfg.spread
        s.p[i * 3] = e.x + Math.cos(a) * 0.15
        s.p[i * 3 + 1] = e.y
        s.p[i * 3 + 2] = e.z + Math.sin(a) * 0.15
        s.v[i * 3] = Math.cos(a) * sp
        s.v[i * 3 + 1] = rand(cfg.up[0], cfg.up[1])
        s.v[i * 3 + 2] = Math.sin(a) * sp
        s.age[i] = 0
        s.life[i] = rand(cfg.life[0], cfg.life[1])
        s.size[i] = rand(cfg.size[0], cfg.size[1])
        s.gravity[i] = cfg.gravity
        m.setColorAt(i, color.set(cfg.colors[Math.floor(Math.random() * cfg.colors.length)]))
        if (m.instanceColor) m.instanceColor.needsUpdate = true
        s.active = POOL // force a pass so the new particle gets drawn
      }
    }
    if (s.active === 0) return

    let alive = 0
    for (let i = 0; i < POOL; i++) {
      let scale = 0
      if (s.age[i] < s.life[i]) {
        s.age[i] += dt
        s.v[i * 3 + 1] -= s.gravity[i] * dt
        s.p[i * 3] += s.v[i * 3] * dt
        s.p[i * 3 + 1] += s.v[i * 3 + 1] * dt
        s.p[i * 3 + 2] += s.v[i * 3 + 2] * dt
        const t = s.age[i] / s.life[i]
        if (t < 1) {
          scale = s.size[i] * Math.min(1, t * 8) * (1 - t * t)
          alive++
        }
      }
      dummy.position.set(s.p[i * 3], s.p[i * 3 + 1], s.p[i * 3 + 2])
      dummy.rotation.set(i * 1.3, i * 0.7, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    // Draw nothing at all when idle.
    m.count = alive ? POOL : 0
    s.active = alive
    if (alive) wake(200)
  })

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, POOL]} count={0} frustumCulled={false} raycast={() => null}>
      <meshLambertMaterial flatShading />
    </instancedMesh>
  )
}
