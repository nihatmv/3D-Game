import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, CylinderGeometry, InstancedMesh, MeshLambertMaterial, Object3D } from 'three'
import { useIslandStore } from '../store/useIslandStore'
import { HALF, SEA_Y } from '../world/constants'
import { DECOR_PATH } from '../world/decor'
import { hash2 } from '../world/grid'
import { groundAt, type TerrainField } from '../world/terrainField'
import { requestShadowUpdate } from './perf'

/**
 * The stone path from the cabin to the beach (DECOR_PATH): flat flagstones
 * that follow the ground, and little stone stairs wherever it drops a level.
 * One instanced mesh, laid out once (its tiles are locked, so the ground under
 * it never changes).
 */

/** Gap between flagstones along the path, and how far the walk samples look for drops. */
const SPACING = 0.25
const FINE = 0.04
/** A drop bigger than this between fine samples is a cliff edge that needs steps. */
const EDGE = 0.18
/** How tall one step may be, and how far each step reaches out from the cliff. */
const STEP_H = 0.15
const STEP_RUN = 0.17

const COLORS = ['#c9c2b8', '#b9b1a6', '#d4cec4', '#aaa196'].map((c) => new Color(c))

type Stone = { x: number; z: number; y: number; h: number; sx: number; sz: number; rot: number }

const toWorld = (t: number) => t - HALF + 0.5

function layOut(field: TerrainField): Stone[] {
  // The path as a dense polyline in world space, with arc length.
  const pts: Array<{ x: number; z: number; s: number; dx: number; dz: number }> = []
  let s = 0
  for (let k = 1; k < DECOR_PATH.length; k++) {
    const ax = toWorld(DECOR_PATH[k - 1][0])
    const az = toWorld(DECOR_PATH[k - 1][1])
    const bx = toWorld(DECOR_PATH[k][0])
    const bz = toWorld(DECOR_PATH[k][1])
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.ceil(len / FINE)
    for (let i = k === 1 ? 0 : 1; i <= n; i++) {
      const t = i / n
      pts.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, s: s + len * t, dx: (bx - ax) / len, dz: (bz - az) / len })
    }
    s += len
  }
  const ground = pts.map((p) => groundAt(field, p.x, p.z))

  const stones: Stone[] = []
  // Arc-length ranges the stairs occupy, so flagstones keep clear of them.
  const busy: Array<[number, number]> = []
  let seed = 0
  const jitter = () => hash2(seed++, 17) - 0.5

  // Stairs: at each drop, steps stepping down and out from the cliff's foot.
  for (let i = 1; i < pts.length; i++) {
    const drop = ground[i - 1] - ground[i]
    if (drop < EDGE) continue
    // The upper surface just before the edge (the bevel dips a little right at the rim).
    const hi = Math.max(ground[Math.max(0, i - 3)], ground[i - 1])
    let lo = ground[i]
    for (let j = i; j < Math.min(pts.length, i + 6); j++) lo = Math.min(lo, ground[j])
    // The beach's drop into the sea gets no stairs: that's where the path ends.
    if (lo < SEA_Y) break
    const n = Math.max(1, Math.round((hi - lo) / STEP_H) - 1)
    const p = pts[i]
    for (let k = 0; k < n; k++) {
      const top = hi - ((k + 1) * (hi - lo)) / (n + 1)
      const out = 0.06 + STEP_RUN * (k + 0.5)
      const h = top - lo + 0.05
      stones.push({
        x: p.x + p.dx * out + jitter() * 0.03,
        z: p.z + p.dz * out + jitter() * 0.03,
        y: lo - 0.05 + h / 2,
        h,
        sx: 0.26 + jitter() * 0.03,
        sz: STEP_RUN * 0.62,
        rot: Math.atan2(p.dx, p.dz) + jitter() * 0.15,
      })
    }
    busy.push([p.s - 0.12, p.s + 0.06 + STEP_RUN * n + 0.08])
  }

  // Flagstones every SPACING, nudged side to side, skipping the stairs.
  const end = pts[pts.length - 1].s
  let i = 0
  for (let at = 0.05; at <= end; at += SPACING) {
    if (busy.some(([a, b]) => at > a && at < b)) continue
    while (i < pts.length - 1 && pts[i].s < at) i++
    const p = pts[i]
    const y = ground[i]
    // The path ends where the beach meets the sea.
    if (y < SEA_Y + 0.02) break
    const side = (stones.length % 2 ? 1 : -1) * 0.07
    stones.push({
      x: p.x - p.dz * side + jitter() * 0.04,
      z: p.z + p.dx * side + jitter() * 0.04,
      y: y + 0.005,
      h: 0.05,
      sx: 0.15 + jitter() * 0.04,
      sz: 0.13 + jitter() * 0.04,
      rot: jitter() * Math.PI,
    })
  }
  return stones
}

const dummy = new Object3D()

export function StonePath() {
  const mesh = useRef<InstancedMesh>(null)
  const stones = useMemo(() => layOut(useIslandStore.getState().field), [])
  // A seven-sided slab reads as a rough-cut flagstone; height 1, scaled per stone.
  const geometry = useMemo(() => new CylinderGeometry(1, 1, 1, 7), [])
  const material = useMemo(() => new MeshLambertMaterial({ flatShading: true }), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    stones.forEach((st, k) => {
      dummy.position.set(st.x, st.y, st.z)
      dummy.rotation.set(0, st.rot, 0)
      dummy.scale.set(st.sx, st.h, st.sz)
      dummy.updateMatrix()
      m.setMatrixAt(k, dummy.matrix)
      m.setColorAt(k, COLORS[Math.floor(hash2(k, 31) * COLORS.length)])
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
    requestShadowUpdate()
  }, [stones])

  return <instancedMesh ref={mesh} args={[geometry, material, stones.length]} receiveShadow raycast={() => null} />
}
