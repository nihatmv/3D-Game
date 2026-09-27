import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Color, InstancedMesh, MeshLambertMaterial, Object3D, Vector3 } from 'three'
import { useIslandStore } from '../store/useIslandStore'
import { GRID, MAX_STONE, TILE_COUNT, tileMin } from '../world/constants'
import { hash2, idx } from '../world/grid'
import { BOULDER_RADIUS, BOULDER_SINK, BOULDER_SQUASH, CAP_H, DRUM_H, DRUM_START, TOWER_SINK, drumsTop } from '../world/stones'
import { groundAt } from '../world/terrainField'
import { requestShadowUpdate, wake } from './perf'
import {
  makeBoulderGeometry,
  makeBrickDrum,
  makeCrown,
  makePlinth,
  makeTowerCap,
  makeWallCap,
  makeWallSegment,
} from './stoneGeometry'

/** Every kind of stone piece is one instanced mesh (one draw call each). */
const PIECES = {
  boulder: { make: makeBoulderGeometry, max: TILE_COUNT },
  plinth: { make: makePlinth, max: TILE_COUNT },
  drum: { make: makeBrickDrum, max: TILE_COUNT * MAX_STONE },
  cap: { make: makeTowerCap, max: TILE_COUNT },
  crown: { make: makeCrown, max: TILE_COUNT },
  wall: { make: makeWallSegment, max: TILE_COUNT * 2 * MAX_STONE },
  wallCap: { make: makeWallCap, max: TILE_COUNT * 2 },
} as const
type PieceKind = keyof typeof PIECES
const KINDS = Object.keys(PIECES) as PieceKind[]

const POP_MS = 320
const dummy = new Object3D()
const tint = new Color()

/** easeOutBack: 0 -> overshoot ~1.1 -> 1. */
function popCurve(t: number): number {
  const c1 = 1.9
  const u = t - 1
  return 1 + (c1 + 1) * u * u * u + c1 * u * u
}

/** A freshly placed piece easing in (scale pop + small drop). */
type Pop = { mesh: InstancedMesh; index: number; pos: Vector3; rotY: number; scale: Vector3; start: number }

/**
 * Stone structures: a boulder for one piece, a brick tower (plinth, drums,
 * cap, and a lantern crown when full) for more, with capped brick walls
 * joining neighbouring towers.
 */
export function Stones() {
  const stoneVersion = useIslandStore((s) => s.stoneVersion)
  const terrainVersion = useIslandStore((s) => s.terrainVersion)

  const geometries = useMemo(() => {
    const g = {} as Record<PieceKind, BufferGeometry>
    for (const k of KINDS) g[k] = PIECES[k].make()
    return g
  }, [])
  const material = useMemo(() => new MeshLambertMaterial({ vertexColors: true, flatShading: true }), [])
  useEffect(() => () => {
    Object.values(geometries).forEach((g) => g.dispose())
    material.dispose()
  }, [geometries, material])

  const meshes = useRef<Partial<Record<PieceKind, InstancedMesh>>>({})
  // Instance -> tile index per piece kind, used by Interaction to resolve clicks.
  const tileOf = useMemo(() => {
    const t = {} as Record<PieceKind, Int32Array>
    for (const k of KINDS) t[k] = new Int32Array(PIECES[k].max)
    return t
  }, [])

  // Which tiles just gained a piece, so their new pieces can pop in.
  const prevStones = useMemo(() => new Uint8Array(TILE_COUNT), [])
  const popStart = useMemo(() => new Map<number, number>(), [])
  const pops = useRef<Pop[]>([])

  useLayoutEffect(() => {
    const m = meshes.current
    if (KINDS.some((k) => !m[k])) return
    const { stones, field } = useIslandStore.getState()
    const now = performance.now()
    for (let i = 0; i < TILE_COUNT; i++) if (stones[i] > prevStones[i]) popStart.set(i, now)
    prevStones.set(stones)
    for (const [i, t] of popStart) if (now - t > POP_MS) popStart.delete(i)
    pops.current = []

    const counts = {} as Record<PieceKind, number>
    for (const k of KINDS) counts[k] = 0

    /** Add one piece at the current dummy transform; `pop` makes it ease in. */
    const put = (kind: PieceKind, tile: number, pop: boolean) => {
      const mesh = m[kind]!
      const index = counts[kind]++
      const start = pop ? popStart.get(tile) : undefined
      if (start !== undefined) {
        pops.current.push({ mesh, index, pos: dummy.position.clone(), rotY: dummy.rotation.y, scale: dummy.scale.clone(), start })
        dummy.scale.multiplyScalar(0.001)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      // Subtle per-structure tint so neighbouring towers aren't identical.
      tint.setScalar(0.94 + hash2(tile, 31) * 0.1)
      mesh.setColorAt(index, tint)
      tileOf[kind][index] = tile
    }

    const center = (i: number): [number, number] => [tileMin(i % GRID) + 0.5, tileMin(Math.floor(i / GRID)) + 0.5]
    const towerBase = (i: number) => {
      const [cx, cz] = center(i)
      return groundAt(field, cx, cz) - TOWER_SINK
    }

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const i = idx(x, z)
        const count = stones[i]
        if (count === 0) continue
        const [cx, cz] = center(i)

        if (count === 1) {
          const s = 0.9 + hash2(x, z) * 0.2
          dummy.position.set(
            cx + (hash2(x + 11, z) - 0.5) * 0.1,
            groundAt(field, cx, cz) + BOULDER_RADIUS * BOULDER_SQUASH - BOULDER_SINK,
            cz + (hash2(x, z + 11) - 0.5) * 0.1,
          )
          dummy.rotation.set(0, hash2(x + 3, z + 7) * Math.PI * 2, 0)
          dummy.scale.set(s, 1, s)
          put('boulder', i, true)
          continue
        }

        // A brand-new tower pops in whole; a growing one pops its new top.
        const fresh = popStart.has(i) && count === 2
        const base = towerBase(i)
        const yaw = hash2(x + 5, z + 9) * Math.PI * 2

        dummy.position.set(cx, base, cz)
        dummy.rotation.set(0, yaw, 0)
        dummy.scale.set(1, 1, 1)
        put('plinth', i, fresh)
        for (let k = 0; k < count; k++) {
          dummy.position.set(cx, base + DRUM_START + k * DRUM_H, cz)
          dummy.rotation.set(0, yaw + k * 0.35, 0)
          dummy.scale.set(1, 1, 1)
          put('drum', i, fresh || k === count - 1)
        }
        const top = base + TOWER_SINK + drumsTop(count)
        dummy.position.set(cx, top, cz)
        dummy.rotation.set(0, yaw, 0)
        dummy.scale.set(1, 1, 1)
        put('cap', i, true)
        if (count >= MAX_STONE) {
          dummy.position.set(cx, top + CAP_H - 0.04, cz)
          dummy.scale.set(1, 1, 1)
          put('crown', i, true)
        }

        // Walls to the +x / +z neighbour towers (each pair once).
        for (const [dx, dz] of [[1, 0], [0, 1]] as const) {
          const nx = x + dx
          const nz = z + dz
          if (nx >= GRID || nz >= GRID) continue
          const n = idx(nx, nz)
          if (stones[n] < 2) continue
          const levels = Math.min(count, stones[n])
          const wallBase = Math.min(base, towerBase(n))
          const rot = dx === 1 ? 0 : Math.PI / 2
          for (let k = 0; k < levels; k++) {
            dummy.position.set(cx + dx * 0.5, wallBase + DRUM_START + k * DRUM_H, cz + dz * 0.5)
            dummy.rotation.set(0, rot, 0)
            dummy.scale.set(1, 1, 1)
            put('wall', i, false)
          }
          dummy.position.set(cx + dx * 0.5, wallBase + DRUM_START + levels * DRUM_H, cz + dz * 0.5)
          dummy.rotation.set(0, rot, 0)
          dummy.scale.set(1, 1, 1)
          put('wallCap', i, false)
        }
      }
    }

    for (const k of KINDS) {
      const mesh = m[k]!
      mesh.count = counts[k]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    requestShadowUpdate()
  }, [stoneVersion, terrainVersion, prevStones, popStart, tileOf])

  useFrame(() => {
    const list = pops.current
    if (list.length === 0) return
    const now = performance.now()
    let w = 0
    for (const p of list) {
      const t = Math.min(1, (now - p.start) / POP_MS)
      const e = popCurve(t)
      dummy.position.copy(p.pos)
      dummy.position.y += (1 - Math.min(1, t * 1.6)) * 0.25
      dummy.rotation.set(0, p.rotY, 0)
      dummy.scale.copy(p.scale).multiplyScalar(Math.max(0.001, e))
      dummy.updateMatrix()
      p.mesh.setMatrixAt(p.index, dummy.matrix)
      p.mesh.instanceMatrix.needsUpdate = true
      if (t < 1) list[w++] = p
    }
    list.length = w
    wake(200)
    if (w === 0) requestShadowUpdate()
  })

  return (
    <>
      {KINDS.map((kind) => (
        <instancedMesh
          key={kind}
          ref={(mesh) => {
            if (mesh) meshes.current[kind] = mesh
          }}
          args={[geometries[kind], material, PIECES[kind].max]}
          count={0}
          castShadow
          receiveShadow
          name="stones"
          userData={{ tileOf: tileOf[kind] }}
        />
      ))}
    </>
  )
}
