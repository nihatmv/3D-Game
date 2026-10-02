import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three'
import { useIslandStore } from '../../store/useIslandStore'
import { isTourActive, selectActiveQuest, useStoryStore } from '../../store/useStoryStore'
import { PIER_DIR, findPier, type Placement } from '../../story/landmarks'
import { runQuestBuild } from '../../story/questBuild'
import { breathingBpm, demoOf, loadBreathing, loadCommit, playCue, useDemoStore } from '../../story/demos'
import { timeAgo } from '../../story/githubCommit'
import { GRID, HALF } from '../../world/constants'
import { QUESTS, onTarget, type Quest } from '../../story/quests'
import { isLowPower, requestShadowUpdate, wake } from '../perf'
import { emit } from '../puffs'
import { LAMP_R, LAMP_Y, PIER_DECK_Y, PIER_LENGTH, landmarkGeometry } from './landmarkGeometry'
import { setLandmarkHovered } from './landmarkHover'

const BUILD_MS = 900
/** The tree grows from a sapling, more slowly than the other landmarks pop up, mostly after the camera lands. */
const TREE_GROW_MS = 2000
const TREE_DELAY_MS = 400

const BREATHING_ID = demoOf('breathing')?.projectId
const COMMIT_ID = demoOf('commit')?.projectId
const SONG_ID = demoOf('song')?.projectId

/** The Breathing monitor card is open: lamp and base glow pulse at the breathing rhythm. */
const breathingShown = () => BREATHING_ID !== undefined && useStoryStore.getState().openCard === BREATHING_ID

/** 0..1 breath (in, then out) at the sample file's rate. */
const breath = (seconds: number) => 0.5 - 0.5 * Math.cos((2 * Math.PI * breathingBpm() * seconds) / 60)

/** Keep in-world labels under the story cards (z-index 3). */
const LABEL_Z: [number, number] = [2, 0]

/** easeOutBack: 0 -> overshoot -> 1. */
function popCurve(t: number): number {
  const c1 = 1.7
  const u = t - 1
  return 1 + (c1 + 1) * u * u * u + c1 * u * u
}

/**
 * Two soft light cones sweeping around the lamp (hidden on slow machines).
 * The lamp breathes while the Breathing monitor card is open.
 */
function LighthouseBeam() {
  const ref = useRef<Group>(null)
  const cones = useRef<Group>(null)
  const lamp = useRef<Mesh>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (ref.current) ref.current.rotation.y = t * 0.7
    if (cones.current) cones.current.visible = !isLowPower()
    if (lamp.current) lamp.current.scale.setScalar(breathingShown() ? 1 + breath(t) * 0.6 : 1)
  })
  return (
    <group ref={ref} position-y={LAMP_Y}>
      <mesh ref={lamp} raycast={() => null}>
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

/** GitPulse: the latest commit, live from GitHub, floating over the lamp. */
function CommitLabel() {
  const commit = useDemoStore((s) => s.commit)
  const shown = useStoryStore((s) => s.openCard === null || s.openCard === COMMIT_ID)
  useEffect(loadCommit, [])
  if (!commit || !shown) return null
  return (
    <Html position-y={LAMP_Y + 0.75} center zIndexRange={LABEL_Z} className="lm-label-wrap">
      <div className="lm-label">
        <span className="lm-label-kicker">
          <span className={`lm-dot${commit.live ? ' live' : ''}`} />
          {commit.live ? 'Latest commit' : 'Recent commit'}
          {commit.date && ` · ${timeAgo(commit.date)}`}
        </span>
        <span className="lm-label-text">{commit.message}</span>
      </div>
    </Html>
  )
}

/** Breathing monitor: a ring around the base that glows in and out while its card is open. */
function BaseGlow() {
  const ring = useRef<Mesh>(null)
  const material = useMemo(
    () => new MeshBasicMaterial({ color: '#9ff0e6', transparent: true, depthWrite: false, blending: AdditiveBlending }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useEffect(loadBreathing, [])
  useFrame((state) => {
    const r = ring.current
    if (!r) return
    r.visible = breathingShown()
    if (!r.visible) return
    const b = breath(state.clock.elapsedTime)
    r.scale.setScalar(0.85 + b * 0.5)
    material.opacity = 0.25 + b * 0.5
    wake(200)
  })
  return (
    <mesh ref={ring} position-y={0.04} rotation-x={-Math.PI / 2} material={material} renderOrder={3} visible={false} raycast={() => null}>
      <ringGeometry args={[0.6, 1, 32]} />
    </mesh>
  )
}

/** Cue: "Recognized: <song>" pops up over the pond after the clip. */
function SongBubble() {
  const cue = useDemoStore((s) => s.cue)
  const shown = useStoryStore((s) => s.openCard === null || s.openCard === SONG_ID)
  const song = demoOf('song')?.demo.song
  if (cue === 'idle' || !song || !shown) return null
  return (
    <Html position-y={1.4} center zIndexRange={LABEL_Z} className="lm-label-wrap">
      <div className={`lm-label lm-bubble${cue === 'recognized' ? ' found' : ''}`} key={cue}>
        {cue === 'listening' ? (
          <span className="lm-label-text">🎧 Listening…</span>
        ) : (
          <>
            <span className="lm-label-kicker">Recognized</span>
            <span className="lm-label-text">🎵 {song}</span>
          </>
        )}
      </div>
    </Html>
  )
}

const RIPPLES = 3
const RIPPLE_SECONDS = 2.4

/** Rings that spread over the pond like sound waves; faster and wider while Cue is listening. */
function PondRipples() {
  const rings = useRef<(Mesh | null)[]>([])
  const materials = useMemo(
    () => Array.from({ length: RIPPLES }, () => new MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false })),
    [],
  )
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])
  useFrame((state) => {
    const listening = useDemoStore.getState().cue === 'listening'
    const t = (state.clock.elapsedTime * (listening ? 2.2 : 1)) / RIPPLE_SECONDS
    rings.current.forEach((ring, k) => {
      if (!ring) return
      const phase = (t + k / RIPPLES) % 1
      ring.scale.setScalar(0.2 + phase * (listening ? 2.0 : 1.2))
      materials[k].opacity = (1 - phase) * (listening ? 0.85 : 0.55)
    })
    if (listening) wake(200)
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

/** An invisible floor over the lake's water tiles (the quest's click shape), so a click anywhere on the lake plays Cue. */
function LakeHitArea({ quest, at }: { quest: Quest; at: Placement }) {
  const geometry = useMemo(() => {
    const pos: number[] = []
    for (const [dx, dz] of quest.clicks) {
      const x0 = quest.area.x + dx - HALF - at.x
      const z0 = quest.area.z + dz - HALF - at.z
      pos.push(x0, 0, z0, x0, 0, z0 + 1, x0 + 1, 0, z0, x0 + 1, 0, z0, x0, 0, z0 + 1, x0 + 1, 0, z0 + 1)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    g.computeBoundingSphere()
    return g
  }, [quest, at])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    // Hidden meshes aren't drawn but still take raycasts.
    <mesh geometry={geometry} position-y={0.02} visible={false} />
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
    if (quest.landmark === 'bigTree') {
      // Sapling to full tree: shoots up first, then fills out.
      const t = Math.max(0, Math.min(1, (performance.now() - start.current - TREE_DELAY_MS) / TREE_GROW_MS))
      if (t < 1) {
        const xz = 0.25 + 0.75 * (1 - (1 - t) ** 3)
        g.scale.set(xz, 0.12 + 0.88 * popCurve(t * t), xz)
        wake(200)
        requestShadowUpdate()
        return
      }
    }
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
    // Cue demo: the pond "listens" whenever it's clicked, in the tour too.
    if (quest.landmark === 'pondRipples' && SONG_ID) playCue()
    // During the tour a landmark standing on the next target (the lighthouse base) is part of it.
    const story = useStoryStore.getState()
    const next = selectActiveQuest(story)
    if (isTourActive(story)) {
      if (next && onTarget(next.area, at.tile % GRID, Math.floor(at.tile / GRID))) runQuestBuild(next)
      return
    }
    openProject(quest.projectId, at)
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
      {quest.landmark === 'lighthouseTop' && COMMIT_ID && <CommitLabel />}
      {quest.landmark === 'lighthouseBase' && BREATHING_ID && <BaseGlow />}
      {quest.landmark === 'pondRipples' && <PondRipples />}
      {quest.landmark === 'pondRipples' && <LakeHitArea quest={quest} at={at} />}
      {quest.landmark === 'pondRipples' && SONG_ID && <SongBubble />}
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
