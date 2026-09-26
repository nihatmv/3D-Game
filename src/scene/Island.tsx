import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, DataTexture, FloatType, Mesh, MeshLambertMaterial, NearestFilter, RedFormat } from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { useIslandStore } from '../store/useIslandStore'
import { GRID, ISLAND_BOTTOM, TILE_COUNT } from '../world/constants'
import { buildTerrainGeometry } from '../world/terrainGeometry'
import { requestShadowUpdate, wake } from './perf'

// BVH-accelerated raycasting for the terrain mesh.
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
Mesh.prototype.raycast = acceleratedRaycast

/** Speed of the height glide (higher = snappier). ~200ms to settle. */
const EASE = 20
const SNAP = 0.004
/** Where new land rises from / sunk land sinks to. */
const OCEAN_SURFACE = ISLAND_BOTTOM - 0.2

/**
 * Terrain mesh, rebuilt once per edit from the smooth terrain field.
 *
 * Height changes glide on the GPU: each tile has an offset (displayed minus
 * real height) in a tiny 32x32 texture that eases back to 0. Vertices read
 * their tile's offset; wall bases only follow downward offsets so walls
 * stretch instead of lifting off the ground, and layers under a tile's top only
 * move if the animated surface sinks below them.
 */
export function Island() {
  const terrainVersion = useIslandStore((s) => s.terrainVersion)

  const offsets = useMemo(() => {
    const tex = new DataTexture(new Float32Array(TILE_COUNT), GRID, GRID, RedFormat, FloatType)
    tex.magFilter = tex.minFilter = NearestFilter
    tex.needsUpdate = true
    return tex
  }, [])
  const offsetData = offsets.image.data as Float32Array

  const material = useMemo(() => {
    const mat = new MeshLambertMaterial({ vertexColors: true, flatShading: true })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uOffsets = { value: offsets }
      shader.vertexShader =
        'attribute vec3 aAnim;\nuniform sampler2D uOffsets;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          /* glsl */ `#include <begin_vertex>
          vec2 tuv = vec2((mod(aAnim.x, ${GRID}.0) + 0.5) / ${GRID}.0, (floor(aAnim.x / ${GRID}.0) + 0.5) / ${GRID}.0);
          float off = texture2D(uOffsets, tuv).r;
          // The tile's own top layer glides fully; layers beneath it only move
          // once the animated surface actually drops below them.
          float d = aAnim.z > 0.001 ? min(0.0, off + aAnim.z) : off;
          transformed.y += mix(min(d, 0.0), d, aAnim.y);`,
        )
    }
    mat.customProgramCacheKey = () => 'island-anim'
    return mat
  }, [offsets])

  // Previous resting surface per tile, to turn each edit into a glide offset.
  const prevSurf = useMemo(() => {
    const s = useIslandStore.getState().field.tileSurf
    return Float32Array.from(s, (y) => (y === -Infinity ? OCEAN_SURFACE : y))
  }, [])

  const geometry = useMemo(() => {
    const { height, type, field } = useIslandStore.getState()
    const geo = buildTerrainGeometry(height, type, field)
    geo.computeBoundsTree()
    return geo
  }, [terrainVersion])

  useEffect(() => () => {
    geometry.disposeBoundsTree()
    geometry.dispose()
  }, [geometry])
  useEffect(() => () => {
    material.dispose()
    offsets.dispose()
  }, [material, offsets])

  // Each edit: whatever moved starts from where it was shown and eases in.
  useEffect(() => {
    const surf = useIslandStore.getState().field.tileSurf
    let changed = false
    for (let i = 0; i < TILE_COUNT; i++) {
      const next = surf[i] === -Infinity ? OCEAN_SURFACE : surf[i]
      if (next !== prevSurf[i]) {
        offsetData[i] = surf[i] === -Infinity ? 0 : offsetData[i] + prevSurf[i] - next
        prevSurf[i] = next
        changed = true
      }
    }
    if (changed) {
      offsets.needsUpdate = true
      wake()
    }
  }, [terrainVersion, prevSurf, offsetData, offsets])

  useFrame((_, dt) => {
    let active = false
    const k = Math.exp(-Math.min(dt, 0.05) * EASE)
    for (let i = 0; i < TILE_COUNT; i++) {
      const o = offsetData[i]
      if (o === 0) continue
      const n = o * k
      offsetData[i] = Math.abs(n) < SNAP ? 0 : n
      active = true
    }
    if (!active) return
    offsets.needsUpdate = true
    wake(200)
    // Shadows use the resting shape; refresh them a few times while settling.
    requestShadowUpdate()
  })

  return <mesh geometry={geometry} material={material} castShadow receiveShadow name="terrain" />
}
