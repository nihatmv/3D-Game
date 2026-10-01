import { useEffect, useRef, type ReactNode } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useIslandStore, type TileCoord } from '../store/useIslandStore'
import { GRID, HALF, SEA_Y, surfaceY } from '../world/constants'
import { idx, inBounds } from '../world/grid'
import { stackHeight } from '../world/stones'
import { isRemoveMode } from './modifiers'
import { emit, type PuffKind } from './puffs'

const probe = new Vector3()

/**
 * Resolve a pointer hit to a tile. Hits on walls/chamfers are nudged back
 * against the face normal so they select the tile that owns the face.
 */
function tileFromEvent(e: ThreeEvent<PointerEvent>): TileCoord | null {
  // Instanced props (stones) know which tile each instance sits on.
  const tileOf = e.object.userData.tileOf as Int32Array | undefined
  if (tileOf && e.instanceId !== undefined) {
    const i = tileOf[e.instanceId]
    return { x: i % GRID, z: Math.floor(i / GRID) }
  }
  probe.copy(e.point)
  if (e.object.name === 'terrain' && e.face) probe.addScaledVector(e.face.normal, -0.05)
  const x = Math.floor(probe.x + HALF)
  const z = Math.floor(probe.z + HALF)
  return inBounds(x, z) ? { x, z } : null
}

/** World y of the visible surface on a tile right now (water, stack, ground or sea). */
function surfaceAt(i: number): number {
  const { height, type, pondLevel, stones } = useIslandStore.getState()
  if (!Number.isNaN(pondLevel[i])) return pondLevel[i]
  if (height[i] === 0) return SEA_Y
  return surfaceY(height[i], type[i]) + stackHeight(stones[i])
}

/**
 * Apply the active tool (or its reverse) to one tile and play a puff for it.
 * `point` is the world hit point; `first` is true for the first tile of a stroke.
 */
function applyTool(t: TileCoord, reverse: boolean, point: Vector3, first: boolean): boolean {
  const s = useIslandStore.getState()
  const i = idx(t.x, t.z)
  const cx = t.x - HALF + 0.5
  const cz = t.z - HALF + 0.5
  const puff = (kind: PuffKind, count?: number) => emit(kind, cx, surfaceAt(i) + 0.05, cz, count)

  switch (s.tool) {
    case 'soil': {
      const ok = reverse ? s.lower(t.x, t.z) : s.raise(t.x, t.z)
      if (ok) puff(s.height[i] === 0 ? 'splash' : 'dirt')
      return ok
    }
    case 'water': {
      const ok = reverse ? s.fill(t.x, t.z) : s.dig(t.x, t.z)
      if (ok) puff(reverse ? 'dirt' : 'splash')
      return ok
    }
    case 'stone': {
      // Reverse: puff where the removed piece was, before it disappears.
      const top = surfaceAt(i)
      const ok = reverse ? s.removeStone(t.x, t.z) : s.addStone(t.x, t.z)
      if (ok) emit('dust', cx, reverse ? top : surfaceAt(i) - 0.1, cz)
      return ok
    }
    case 'seeds': {
      if (reverse) {
        const ok = s.removePlants(t.x, t.z)
        if (ok) puff('leaves', 10)
        return ok
      }
      // A click scatters a handful; dragging sows a lighter trail.
      const count = first ? 3 + Math.floor(Math.random() * 3) : 2
      const grown = s.scatterSeeds(point.x, point.z, count, first ? 1.2 : 0.6)
      if (grown > 0) emit('leaves', point.x, point.y + 0.05, point.z, 3 + grown * 2)
      if (grown < count) emit('fizzle', point.x, point.y + 0.05, point.z)
      return grown > 0
    }
  }
}

type Stroke = { visited: Set<number>; reverse: boolean }
/** A finger that went down on a tile; it builds there only if it lifts without moving. */
type Tap = { id: number; x: number; y: number; tile: TileCoord; point: Vector3 }

/** How far (px) a finger may drift and still count as a tap. */
const TAP_SLOP = 12

/**
 * Wraps pickable meshes (terrain, ocean) and routes pointer input.
 * Mouse/pen: click or drag to paint. Touch: a tap builds on one tile when the
 * finger lifts, with no drag painting, and any second finger turns the touch into a
 * camera gesture instead.
 */
export function Interaction({ children }: { children: ReactNode }) {
  const setHover = useIslandStore((s) => s.setHover)
  const stroke = useRef<Stroke | null>(null)
  const tap = useRef<Tap | null>(null)
  const touches = useRef(new Set<number>())

  useEffect(() => {
    // Capture phase, so the count is current before the canvas handlers run.
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      touches.current.add(e.pointerId)
      if (touches.current.size > 1) tap.current = null
    }
    const move = (e: PointerEvent) => {
      const t = tap.current
      if (t && e.pointerId === t.id && Math.hypot(e.clientX - t.x, e.clientY - t.y) > TAP_SLOP) tap.current = null
    }
    // End the stroke wherever the button is released (even off-canvas).
    const up = (e: PointerEvent) => {
      stroke.current = null
      touches.current.delete(e.pointerId)
      const t = tap.current
      if (t && e.pointerId === t.id && e.type === 'pointerup') applyTool(t.tile, isRemoveMode(false), t.point, true)
      if (t && e.pointerId === t.id) tap.current = null
    }
    const blur = () => {
      stroke.current = null
      tap.current = null
      touches.current.clear()
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const paint = (t: TileCoord | null, point: Vector3) => {
    const s = stroke.current
    if (!s || !t) return
    const i = idx(t.x, t.z)
    if (s.visited.has(i)) return
    s.visited.add(i)
    applyTool(t, s.reverse, point, s.visited.size === 1)
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const t = tileFromEvent(e)
    if (e.pointerType === 'touch') {
      if (touches.current.size > 1 || !t) return
      tap.current = { id: e.pointerId, x: e.clientX, y: e.clientY, tile: t, point: e.point.clone() }
      setHover(t)
      return
    }
    stroke.current = { visited: new Set(), reverse: isRemoveMode(e.shiftKey) }
    setHover(t)
    paint(t, e.point)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    // Fingers only hover while they touch; keep the highlight on the tapped tile.
    if (e.pointerType === 'touch') return
    const t = tileFromEvent(e)
    setHover(t)
    paint(t, e.point)
  }

  return (
    <group
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={(e) => e.pointerType !== 'touch' && setHover(null)}
    >
      {children}
    </group>
  )
}
