import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, MeshLambertMaterial, Object3D } from 'three'
import { useIslandStore, type Plant } from '../store/useIslandStore'
import { GRID, GROW_MS, HALF } from '../world/constants'
import { groundAt } from '../world/terrainField'
import { hash2 } from '../world/grid'
import { MAX_PLANTS, PLANT_KINDS, type PlantKind } from '../world/plantRules'
import { requestShadowUpdate, wake } from './perf'
import { makePlantGeometries } from './plantGeometry'

const SHADOW_INTERVAL_MS = 250
const dummy = new Object3D()
const tint = new Color()

/** Per-kind size multiplier so small plants still read at normal zoom. */
const KIND_SCALE: Record<PlantKind, number> = {
  tuft: 1.5,
  flower: 1.45,
  bush: 1.2,
  reed: 1.35,
  cattail: 1.3,
  tree: 1.05,
  pine: 1.05,
}

/** Growth curve over GROW_MS: a tiny sprout that grows steadily, then settles. */
function growth(t: number): number {
  if (t >= 1) return 1
  if (t <= 0) return 0.08
  const e = t * t * (3 - 2 * t) // smoothstep: slow start, steady middle, soft finish
  return 0.08 + 0.92 * e
}

/** Shared material: gentle wind sway done entirely in the vertex shader. */
function makePlantMaterial(time: { value: number }) {
  const mat = new MeshLambertMaterial({ vertexColors: true, flatShading: true })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
      #else
        vec3 ip = vec3(0.0);
      #endif
      float ph = ip.x * 1.7 + ip.z * 1.3;
      float w = max(position.y, 0.0);
      transformed.x += sin(uTime * 1.6 + ph) * 0.05 * w * w;
      transformed.z += cos(uTime * 1.25 + ph * 0.7) * 0.035 * w * w;`,
    )
  }
  mat.customProgramCacheKey = () => 'plant-sway'
  return mat
}

type Growing = { plant: Plant; kind: PlantKind; index: number; ground: number }

export function Plants() {
  const plantVersion = useIslandStore((s) => s.plantVersion)
  const terrainVersion = useIslandStore((s) => s.terrainVersion)

  const geometries = useMemo(makePlantGeometries, [])
  const time = useMemo(() => ({ value: 0 }), [])
  const material = useMemo(() => makePlantMaterial(time), [time])
  useEffect(() => () => {
    Object.values(geometries).forEach((g) => g.dispose())
    material.dispose()
  }, [geometries, material])

  const meshes = useRef<Partial<Record<PlantKind, InstancedMesh>>>({})
  const growing = useRef<Growing[]>([])
  const lastShadow = useRef(0)

  const place = (mesh: InstancedMesh, index: number, p: Plant, ground: number, s: number) => {
    const x = p.tile % GRID
    const z = Math.floor(p.tile / GRID)
    dummy.position.set(x - HALF + 0.5 + p.ox, ground, z - HALF + 0.5 + p.oz)
    dummy.rotation.set(0, p.rot, 0)
    dummy.scale.setScalar(p.scale * KIND_SCALE[p.kind] * s)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
  }

  // Full rebuild whenever plants or the ground under them change.
  useLayoutEffect(() => {
    const { plants, field } = useIslandStore.getState()
    const now = performance.now()
    const counts: Record<string, number> = {}
    growing.current = []

    for (const p of plants) {
      const mesh = meshes.current[p.kind]
      if (!mesh) continue
      const index = counts[p.kind] ?? 0
      counts[p.kind] = index + 1
      // Sit on the real (curved) ground under the plant, not the tile's flat level.
      const ground = groundAt(field, (p.tile % GRID) - HALF + 0.5 + p.ox, Math.floor(p.tile / GRID) - HALF + 0.5 + p.oz)
      const t = (now - p.plantedAt) / GROW_MS
      place(mesh, index, p, ground, growth(t))
      tint.setScalar(0.9 + hash2(p.id, 7) * 0.18)
      mesh.setColorAt(index, tint)
      if (t < 1) growing.current.push({ plant: p, kind: p.kind, index, ground })
    }

    for (const kind of PLANT_KINDS) {
      const mesh = meshes.current[kind]
      if (!mesh) continue
      mesh.count = counts[kind] ?? 0
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    requestShadowUpdate()
  }, [plantVersion, terrainVersion])

  useFrame(() => {
    time.value = performance.now() / 1000
    const list = growing.current
    if (list.length === 0) return

    const now = performance.now()
    const touched = new Set<InstancedMesh>()
    let w = 0
    for (let r = 0; r < list.length; r++) {
      const g = list[r]
      const mesh = meshes.current[g.kind]!
      const t = (now - g.plant.plantedAt) / GROW_MS
      place(mesh, g.index, g.plant, g.ground, growth(t))
      touched.add(mesh)
      if (t < 1) list[w++] = g
    }
    list.length = w
    touched.forEach((mesh) => (mesh.instanceMatrix.needsUpdate = true))

    // Keep full frame rate while things grow; refresh shadows a few times a second.
    wake(300)
    if (w === 0 || now - lastShadow.current > SHADOW_INTERVAL_MS) {
      lastShadow.current = now
      requestShadowUpdate()
    }
  })

  return (
    <>
      {PLANT_KINDS.map((kind) => (
        <instancedMesh
          key={kind}
          ref={(m) => {
            if (m) meshes.current[kind] = m
          }}
          args={[geometries[kind], material, MAX_PLANTS]}
          count={0}
          castShadow
          receiveShadow
          frustumCulled={false}
          raycast={() => null}
        />
      ))}
    </>
  )
}
