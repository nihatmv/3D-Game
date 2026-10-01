import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three'
import { useIslandStore } from '../../store/useIslandStore'
import { isTourActive, selectActiveQuest, useStoryStore } from '../../store/useStoryStore'
import { PIER_DIR, findPier, type Placement } from '../../story/landmarks'
import { runQuestBuild } from '../../story/questBuild'
import { GRID } from '../../world/constants'
import { QUESTS, onTarget, type Quest } from '../../story/quests'
import { isLowPower, requestShadowUpdate, wake } from '../perf'
import { emit } from '../puffs'
import { LAMP_R, LAMP_Y, PIER_DECK_Y, PIER_LENGTH, landmarkGeometry } from './landmarkGeometry'
import { setLandmarkHovered } from './landmarkHover'

const BUILD_MS = 900

/** easeOutBack: 0 -> overshoot -> 1. */
function popCurve(t: number): number {
  const c1 = 1.7
  const u = t - 1
  return 1 + (c1 + 1) * u * u * u + c1 * u * u
}

/** Two soft light cones sweeping around the lamp (hidden on slow machines). */
function LighthouseBeam() {
  const ref = useRef<Group>(null)
  const cones = useRef<Group>(null)
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.7
    if (cones.current) cones.current.visible = !isLowPower()
  })
  return (
    <group ref={ref} position-y={LAMP_Y}>
      <mesh raycast={() => null}>
        <sphereGeometry args={[LAMP_R, 10, 8]} />
        <meshBasicMaterial color="#fff3b8" />
      </mesh>
      <group ref={cones}>
        {[0, Math.PI].map((a) => (
          <mesh key={a} rotation={[0, a, Math.PI / 2]} position={[Math.cos(a) * 3.2, 0, -Math.sin(a) * 3.2]} raycast={() => null}>
            <coneGeometry args={[0.9, 6, 16, 1, true]} />
            <meshBasicMaterial color="#fff1c2" transparent opacity={0.16} depthWrite={false} side={DoubleSide} blending={AdditiveBlending} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

const RIPPLES = 3
const RIPPLE_SECONDS = 2.4

/** Rings that spread over the pond like sound waves. */
function PondRipples() {
  const rings = useRef<(Mesh | null)[]>([])
  const materials = useMemo(
    () => Array.from({ length: RIPPLES }, () => new MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false })),
    [],
  )
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])
  useFrame((state) => {
    const t = state.clock.elapsedTime / RIPPLE_SECONDS
    rings.current.forEach((ring, k) => {
      if (!ring) return
      const phase = (t + k / RIPPLES) % 1
      ring.scale.setScalar(0.15 + phase * 0.85)
      materials[k].opacity = (1 - phase) * 0.55
    })
  })
  return (
    <group position-y={0.02}>
      {materials.map((m, k) => (
        <mesh key={k} ref={(el) => void (rings.current[k] = el)} rotation-x={-Math.PI / 2} material={m} renderOrder={3} raycast={() => null}>
          <ringGeometry args={[0.92, 1, 32]} />
        </mesh>
      ))}
    </group>
  )
}

function Landmark({ quest, at }: { quest: Quest; at: Placement }) {
  const group = useRef<Group>(null)
  const start = useRef(performance.now())
  const geometry = landmarkGeometry(quest.landmark)
  const openProject = useStoryStore((s) => s.openProject)
  const hovered = useRef(false)

  // Celebrate: sparkles where it rises (along the deck for the pier).
  useEffect(() => {
    const top = quest.landmark === 'lighthouseTop' ? LAMP_Y : 0.6
    if (quest.landmark === 'pier') {
      for (let k = 0; k < 3; k++) emit('sparkle', at.x + PIER_DIR * (k + 0.5) * (PIER_LENGTH / 3), at.y + 0.4, at.z, 10)
    } else {
      emit('sparkle', at.x, at.y + top, at.z, 22)
    }
    requestShadowUpdate()
  }, [quest.landmark, at])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const t = Math.min(1, (performance.now() - start.current) / BUILD_MS)
    const base = t < 1 ? popCurve(t) : 1
    const target = base * (hovered.current ? 1.05 : 1)
    const s = g.scale.x + (target - g.scale.x) * (t < 1 ? 1 : 0.25)
    g.scale.setScalar(Math.max(0.001, s))
    if (t < 1) {
      wake(200)
      requestShadowUpdate()
    }
  })

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => e.stopPropagation()
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    useIslandStore.getState().setHover(null)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.button !== 0) return
    // During the tour a landmark standing on the next target (the lighthouse base) is part of it.
    const story = useStoryStore.getState()
    const next = selectActiveQuest(story)
    if (isTourActive(story)) {
      if (next && onTarget(next.area, at.tile % GRID, Math.floor(at.tile / GRID))) runQuestBuild(next)
      return
    }
    openProject(quest.projectId)
  }

  return (
    <group
      ref={group}
      position={[at.x, at.y, at.z]}
      scale={0.001}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        hovered.current = true
        setLandmarkHovered(true)
        wake(400)
      }}
      onPointerOut={() => {
        hovered.current = false
        setLandmarkHovered(false)
        wake(400)
      }}
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshLambertMaterial vertexColors flatShading />
      </mesh>
      {quest.landmark === 'lighthouseTop' && <LighthouseBeam />}
      {quest.landmark === 'pondRipples' && <PondRipples />}
    </group>
  )
}

const POLE_H = 1.7
const FLAG_W = 0.62
const FLAG_H = 0.38
const RAISE_SECONDS = 2.2

/**
 * Flagpole at the shore end of the pier. The flag runs up the pole once the
 * ship is tied up, then flutters.
 */
function DockFlag({ pier }: { pier: Placement }) {
  const flag = useRef<Group>(null)
  const raised = useRef(0)
  useFrame((state, rawDt) => {
    const f = flag.current
    if (!f) return
    const docked = useStoryStore.getState().shipState === 'docked'
    if (docked && raised.current < 1) {
      raised.current = Math.min(1, raised.current + Math.min(rawDt, 0.25) / RAISE_SECONDS)
      wake(200)
    }
    const k = 1 - (1 - raised.current) ** 3
    f.visible = raised.current > 0
    f.position.y = 0.35 + k * (POLE_H - FLAG_H / 2 - 0.4)
    const t = state.clock.elapsedTime
    f.rotation.y = Math.sin(t * 2.3) * 0.18
    f.scale.x = 0.92 + Math.sin(t * 3.1) * 0.08
  })
  return (
    <group position={[pier.x + PIER_DIR * 0.3, pier.y + PIER_DECK_Y, pier.z - 0.33]}>
      <mesh position-y={POLE_H / 2} castShadow raycast={() => null}>
        <cylinderGeometry args={[0.025, 0.03, POLE_H, 6]} />
        <meshLambertMaterial color="#e9e2d6" />
      </mesh>
      <mesh position-y={POLE_H + 0.03} raycast={() => null}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshLambertMaterial color="#ffd27a" />
      </mesh>
      <group ref={flag} visible={false}>
        <mesh position-x={FLAG_W / 2} raycast={() => null}>
          <boxGeometry args={[FLAG_W, FLAG_H, 0.015]} />
          <meshLambertMaterial color="#e9a55a" />
        </mesh>
        <mesh position={[FLAG_W * 0.42, 0, 0.002]} raycast={() => null}>
          <boxGeometry args={[FLAG_W * 0.84, FLAG_H * 0.22, 0.017]} />
          <meshLambertMaterial color="#fff6e8" />
        </mesh>
      </group>
    </group>
  )
}

/** Every built landmark, each one clickable to reopen its project card. */
export function Landmarks() {
  const built = useStoryStore((s) => s.built)
  const placed = useStoryStore((s) => s.placed)
  const pier = findPier(placed, QUESTS)
  return (
    <>
      {QUESTS.filter((q) => built.includes(q.id) && placed[q.id]).map((q) => (
        <Landmark key={q.id} quest={q} at={placed[q.id]} />
      ))}
      {pier && <DockFlag pier={pier} />}
    </>
  )
}
