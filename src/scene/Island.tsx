import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Mesh } from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { useIslandStore } from '../store/useIslandStore'
import { TILE_COUNT } from '../world/constants'
import { buildTerrainGeometry, targetSurfaces } from '../world/terrainGeometry'
import { requestShadowUpdate, wake } from './perf'

// BVH-accelerated raycasting for the (fairly dense) terrain mesh.
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
Mesh.prototype.raycast = acceleratedRaycast

/** Speed of the height ease (higher = snappier). ~180ms to settle. */
const EASE = 22
const SNAP = 0.004

/**
 * Terrain mesh. Height edits ease in: the displayed surface heights chase the
 * store's target heights, and the mesh is rebuilt only while something moves.
 * The BVH (for picking) is rebuilt once everything has settled.
 */
export function Island() {
  const terrainVersion = useIslandStore((s) => s.terrainVersion)
  const mesh = useRef<Mesh>(null)
  const animating = useRef(false)

  const { display, target } = useMemo(() => {
    const { height, type } = useIslandStore.getState()
    const target = targetSurfaces(height, type, new Float32Array(TILE_COUNT))
    return { display: target.slice(), target }
  }, [])

  const initialGeometry = useMemo(() => {
    const { height, type } = useIslandStore.getState()
    const geo = buildTerrainGeometry(height, type, display)
    geo.computeBoundsTree()
    return geo
  }, [display])

  const swapGeometry = (geo: BufferGeometry) => {
    const m = mesh.current
    if (!m || m.geometry === geo) return
    const old = m.geometry
    m.geometry = geo
    old.disposeBoundsTree()
    old.dispose()
  }

  // New targets on every terrain edit. Colours change instantly; heights ease.
  useEffect(() => {
    if (terrainVersion === 0) return
    const { height, type } = useIslandStore.getState()
    targetSurfaces(height, type, target)
    animating.current = true
    swapGeometry(buildTerrainGeometry(height, type, display))
    wake()
  }, [terrainVersion, target, display])

  useEffect(() => {
    const m = mesh.current
    return () => m?.geometry.dispose()
  }, [])

  useFrame((_, dt) => {
    if (!animating.current) return
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * EASE)
    let moving = false
    for (let i = 0; i < TILE_COUNT; i++) {
      const d = target[i] - display[i]
      if (d === 0) continue
      if (Math.abs(d) < SNAP) display[i] = target[i]
      else {
        display[i] += d * k
        moving = true
      }
    }
    const { height, type } = useIslandStore.getState()
    const geo = buildTerrainGeometry(height, type, display)
    if (!moving) {
      geo.computeBoundsTree()
      animating.current = false
    }
    swapGeometry(geo)
    requestShadowUpdate()
    wake(200)
  })

  return (
    <mesh ref={mesh} geometry={initialGeometry} castShadow receiveShadow name="terrain">
      <meshLambertMaterial vertexColors flatShading />
    </mesh>
  )
}
