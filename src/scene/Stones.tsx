import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Color, IcosahedronGeometry, InstancedMesh, Object3D, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three-stdlib'
import { useIslandStore } from '../store/useIslandStore'
import { GRID, MAX_STONE, PALETTE, TILE_COUNT, tileMin } from '../world/constants'
import { groundAt } from '../world/terrainField'
import { hash2, idx } from '../world/grid'
import { BLOCKS, BLOCK_NEST, BOULDER_RADIUS, BOULDER_SINK, BOULDER_SQUASH, boulderTop } from '../world/stones'
import { requestShadowUpdate, wake } from './perf'

/** Low-poly boulder: an icosahedron with welded, hash-jittered vertices. */
function makeBoulderGeometry(): BufferGeometry {
  const geo = new IcosahedronGeometry(BOULDER_RADIUS, 0)
  const p = geo.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    // Key by rounded position so shared vertices get the same offset.
    const k1 = Math.round(x * 1000) * 7 + Math.round(z * 1000)
    const k2 = Math.round(y * 1000)
    const s = 0.85 + hash2(k1, k2) * 0.3
    p.setXYZ(i, x * s, y * s * BOULDER_SQUASH, z * s)
  }
  geo.computeVertexNormals()
  return geo
}

const MAX_BLOCKS = TILE_COUNT * (MAX_STONE - 1)
const dummy = new Object3D()
const baseColor = new Color(PALETTE.stone)
const warm = new Color('#d8c8b4')
const cool = new Color('#b3bcc4')
const tmpColor = new Color()

function pieceColor(x: number, z: number, k: number): Color {
  const r = hash2(x * 5 + k, z * 3 - k)
  tmpColor.copy(baseColor).lerp(r < 0.5 ? warm : cool, Math.abs(r - 0.5))
  return tmpColor.multiplyScalar(0.9 + hash2(z + k * 13, x) * 0.14)
}

const POP_MS = 320

/** easeOutBack: 0 -> overshoot ~1.1 -> 1. */
function popCurve(t: number): number {
  const c1 = 1.9
  const u = t - 1
  return 1 + (c1 + 1) * u * u * u + c1 * u * u
}

/** A freshly placed piece easing in (scale pop + small drop). */
type Pop = { mesh: InstancedMesh; index: number; pos: Vector3; rotY: number; scale: Vector3; start: number }

export function Stones() {
  const stoneVersion = useIslandStore((s) => s.stoneVersion)
  const terrainVersion = useIslandStore((s) => s.terrainVersion)
  const boulders = useRef<InstancedMesh>(null)
  const blocks = useRef<InstancedMesh>(null)

  const boulderGeo = useMemo(makeBoulderGeometry, [])
  const blockGeo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.12), [])
  useEffect(() => () => {
    boulderGeo.dispose()
    blockGeo.dispose()
  }, [boulderGeo, blockGeo])

  // Instance -> tile index, used by Interaction to resolve clicks on stones.
  const boulderTiles = useMemo(() => new Int32Array(TILE_COUNT), [])
  const blockTiles = useMemo(() => new Int32Array(MAX_BLOCKS), [])

  // Which tiles just gained a piece, so their new top piece can pop in.
  const prevStones = useMemo(() => new Uint8Array(TILE_COUNT), [])
  const popStart = useMemo(() => new Map<number, number>(), [])
  const pops = useRef<Pop[]>([])

  useLayoutEffect(() => {
    const bm = boulders.current
    const km = blocks.current
    if (!bm || !km) return
    const { stones, field } = useIslandStore.getState()
    const now = performance.now()
    for (let i = 0; i < TILE_COUNT; i++) if (stones[i] > prevStones[i]) popStart.set(i, now)
    prevStones.set(stones)
    for (const [i, t] of popStart) if (now - t > POP_MS) popStart.delete(i)
    pops.current = []

    /** Write a piece's matrix; the newest piece on a tile starts a pop. */
    const put = (mesh: InstancedMesh, index: number, tile: number, isTop: boolean) => {
      const start = isTop ? popStart.get(tile) : undefined
      if (start !== undefined) {
        pops.current.push({
          mesh,
          index,
          pos: dummy.position.clone(),
          rotY: dummy.rotation.y,
          scale: dummy.scale.clone(),
          start,
        })
        dummy.scale.multiplyScalar(0.001)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    }

    let nb = 0
    let nk = 0

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const i = idx(x, z)
        const count = stones[i]
        if (count === 0) continue
        const cx = tileMin(x) + 0.5
        const cz = tileMin(z) + 0.5
        const ground = groundAt(field, cx, cz)

        // Boulder.
        const s = 0.9 + hash2(x, z) * 0.2
        dummy.position.set(
          cx + (hash2(x + 11, z) - 0.5) * 0.1,
          ground + BOULDER_RADIUS * BOULDER_SQUASH - BOULDER_SINK,
          cz + (hash2(x, z + 11) - 0.5) * 0.1,
        )
        dummy.rotation.set(0, hash2(x + 3, z + 7) * Math.PI * 2, 0)
        dummy.scale.set(s, 1, s)
        put(bm, nb, i, count === 1)
        bm.setColorAt(nb, pieceColor(x, z, 0))
        boulderTiles[nb++] = i

        // Blocks, each a little smaller and slightly twisted, like a cairn.
        let base = ground + boulderTop() - BLOCK_NEST
        for (let k = 1; k < count; k++) {
          const b = BLOCKS[k - 1]
          dummy.position.set(
            cx + (hash2(x * 7 + k, z) - 0.5) * 0.08,
            base + b.h / 2,
            cz + (hash2(x, z * 7 + k) - 0.5) * 0.08,
          )
          dummy.rotation.set(0, (hash2(x + k * 17, z - k) - 0.5) * 0.9, 0)
          dummy.scale.set(b.w, b.h, b.w)
          put(km, nk, i, k === count - 1)
          km.setColorAt(nk, pieceColor(x, z, k))
          blockTiles[nk++] = i
          base += b.h - BLOCK_NEST
        }
      }
    }

    for (const [mesh, n] of [[bm, nb], [km, nk]] as const) {
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    requestShadowUpdate()
  }, [stoneVersion, terrainVersion, boulderTiles, blockTiles, prevStones, popStart])

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
      <instancedMesh
        ref={boulders}
        args={[boulderGeo, undefined, TILE_COUNT]}
        castShadow
        receiveShadow
        name="stones"
        userData={{ tileOf: boulderTiles }}
      >
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh
        ref={blocks}
        args={[blockGeo, undefined, MAX_BLOCKS]}
        castShadow
        receiveShadow
        name="stones"
        userData={{ tileOf: blockTiles }}
      >
        <meshLambertMaterial flatShading />
      </instancedMesh>
    </>
  )
}
