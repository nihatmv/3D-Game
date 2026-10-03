import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { useIslandStore } from '../../store/useIslandStore'
import { isTourActive, useStoryStore } from '../../store/useStoryStore'
import { PIER_DIR, findPier, type Placement } from '../../story/landmarks'
import { demoOf, playCue, useDemoStore } from '../../story/demos'
import { HALF } from '../../world/constants'
import { PROJECTS } from '../../story/projects'
import { QUESTS, type LandmarkKind, type Quest } from '../../story/quests'
import { ProjectMedia } from '../../ui/story/ProjectBody'
import { isLowPower, requestShadowUpdate, wake } from '../perf'
import { tod } from '../timeOfDay'
import { emit } from '../puffs'
import { LAMP_R, LAMP_Y, PIER_DECK_Y, PIER_LENGTH, landmarkGeometry } from './landmarkGeometry'
import { setLandmarkHovered } from './landmarkHover'

const BUILD_MS = 900
/** The tree grows from a sapling, more slowly than the other landmarks pop up, mostly after the camera lands. */
const TREE_GROW_MS = 2000
const TREE_DELAY_MS = 400

const SONG_ID = demoOf('song')?.projectId

/** Keep in-world labels under the story cards (z-index 3). */
const LABEL_Z: [number, number] = [2, 0]

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
    const t = state.clock.elapsedTime
    if (ref.current) ref.current.rotation.y = t * 0.7
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

/** Where the hover preview's bottom edge sits: just above each landmark. */
const PREVIEW_AT: Record<LandmarkKind, [number, number]> = {
  lighthouse: [0, LAMP_Y + 0.65],
  pondRipples: [0, 0.9],
  pier: [(PIER_DIR * PIER_LENGTH) / 2, PIER_DECK_Y + 0.6],
  bigTree: [0, 2.95],
}

/** A small window over a hovered landmark: the project's picture and name. Clicking the landmark opens the card. */
function ProjectPreview({ quest }: { quest: Quest }) {
  const project = PROJECTS.find((p) => p.id === quest.projectId)
  // The pond's own bubble ("Listening…", "Recognized") takes the spot while Cue plays.
  const busy = useDemoStore((s) => quest.landmark === 'pondRipples' && s.cue !== 'idle')
  if (!project || busy) return null
  const [x, y] = PREVIEW_AT[quest.landmark]
  return (
    <Html position={[x, y, 0]} center zIndexRange={LABEL_Z} className="lm-label-wrap">
      <div className="lm-preview-lift">
        <div className="lm-preview">
          <ProjectMedia project={project} />
          <span className="lm-label-text">{project.title}</span>
          <span className="lm-label-kicker">Click for details</span>
        </div>
      </div>
    </Html>
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
  const [hovered, setHovered] = useState(false)
  // Outside the tour only: there a click builds instead of opening a card.
  const canPreview = useStoryStore((s) => s.openCard === null && !isTourActive(s))

  // Celebrate: sparkles where it rises (along the deck for the pier).
  useEffect(() => {
    const top = quest.landmark === 'lighthouse' ? LAMP_Y : 0.6
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
    g.scale.setScalar(Math.max(0.001, t < 1 ? popCurve(t) : 1))
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
    // During the tour the cards open on their own; clicking a landmark does nothing.
    if (isTourActive(useStoryStore.getState())) return
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
        if (e.pointerType !== 'touch') setHovered(true)
        setLandmarkHovered(true)
        wake(400)
      }}
      onPointerOut={() => {
        setHovered(false)
        setLandmarkHovered(false)
        wake(400)
      }}
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshLambertMaterial vertexColors flatShading />
      </mesh>
      {quest.landmark === 'lighthouse' && <LighthouseBeam />}
      {quest.landmark === 'pondRipples' && <PondRipples />}
      {quest.landmark === 'pondRipples' && <LakeHitArea quest={quest} at={at} />}
      {quest.landmark === 'pondRipples' && SONG_ID && <SongBubble />}
      {quest.landmark === 'bigTree' && <GroveLife />}
      {hovered && canPreview && <ProjectPreview quest={quest} />}
    </group>
  )
}

const BUTTERFLY_COLORS = ['#ffb347', '#f7a8c4', '#9ad0ff', '#fff27a', '#c9a8ff']
/** Per critter: orbit radius, height, speed, phase. */
const BUTTERFLIES = BUTTERFLY_COLORS.map((_, k) => ({ r: 0.7 + (k % 3) * 0.3, h: 0.45 + (k % 2) * 0.5, v: 0.35 + k * 0.07, p: k * 1.3 }))
const FIREFLIES = Array.from({ length: 10 }, (_, k) => ({ r: 0.4 + ((k * 7) % 10) * 0.1, h: 0.3 + ((k * 3) % 10) * 0.12, v: 0.15 + (k % 4) * 0.05, p: k * 2.1 }))

/** A wing: a rounded fan hinged on the body (x = 0), reaching out along +x. */
function wingGeometry() {
  const pos: number[] = []
  const pts: [number, number][] = [[0, -0.03], [0.08, -0.11], [0.16, -0.08], [0.18, 0.02], [0.13, 0.1], [0.05, 0.08], [0, 0.03]]
  for (let k = 1; k < pts.length - 1; k++) pos.push(...[pts[0], pts[k], pts[k + 1]].flatMap(([x, z]) => [x, 0, z]))
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.computeBoundingSphere()
  return g
}

const _m = new Matrix4()
const _q = new Quaternion()
const _e = new Euler()
const _p = new Vector3()
const _s = new Vector3()

/** Where a critter is at time t: a wobbly loop around the tree. */
function wander(c: { r: number; h: number; v: number; p: number }, t: number, out: Vector3) {
  const a = t * c.v + c.p
  return out.set(Math.cos(a) * c.r * (1 + 0.25 * Math.sin(a * 2.3)), c.h + 0.15 * Math.sin(a * 3.1), Math.sin(a) * c.r * (1 + 0.25 * Math.cos(a * 1.7)))
}

/**
 * Butterflies flapping around the grove, and fireflies that glow brighter at
 * dusk and night (hidden on slow machines). Two instanced meshes, no shadows; they
 * move on the frames that render anyway (no wake()).
 */
function GroveLife() {
  const wings = useRef<InstancedMesh>(null)
  const flies = useRef<InstancedMesh>(null)
  const [wingGeo, flyGeo] = useMemo(() => [wingGeometry(), new IcosahedronGeometry(0.045, 0)], [])
  useEffect(() => () => (wingGeo.dispose(), flyGeo.dispose()), [wingGeo, flyGeo])

  useEffect(() => {
    const w = wings.current
    if (!w) return
    const c = new Color()
    BUTTERFLY_COLORS.forEach((col, k) => {
      w.setColorAt(2 * k, c.set(col))
      w.setColorAt(2 * k + 1, c.set(col))
    })
    if (w.instanceColor) w.instanceColor.needsUpdate = true
  }, [])

  const ahead = useMemo(() => new Vector3(), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const w = wings.current
    if (w) {
      BUTTERFLIES.forEach((b, k) => {
        wander(b, t, _p)
        wander(b, t + 0.05, ahead)
        const heading = Math.atan2(ahead.x - _p.x, ahead.z - _p.z)
        const flap = 0.25 + 0.9 * Math.abs(Math.sin(t * 14 + b.p))
        for (const side of [1, -1]) {
          _q.setFromEuler(_e.set(0, heading + Math.PI / 2, side * flap, 'YXZ'))
          _s.set(side, 1, 1)
          w.setMatrixAt(2 * k + (side > 0 ? 0 : 1), _m.compose(_p, _q, _s))
        }
      })
      w.instanceMatrix.needsUpdate = true
    }
    const f = flies.current
    if (f) {
      f.visible = !isLowPower()
      const glow = 0.6 + 0.8 * tod.glow
      FIREFLIES.forEach((c, k) => {
        wander(c, t, _p)
        const pulse = glow * (0.5 + 0.5 * Math.sin(t * (2 + (k % 3)) + c.p))
        f.setMatrixAt(k, _m.compose(_p, _q.identity(), _s.setScalar(Math.max(0.05, pulse))))
      })
      f.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={wings} args={[wingGeo, undefined, BUTTERFLIES.length * 2]} raycast={() => null} frustumCulled={false}>
        <meshBasicMaterial side={DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={flies} args={[flyGeo, undefined, FIREFLIES.length]} raycast={() => null} frustumCulled={false}>
        <meshBasicMaterial color="#fff2a0" transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
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
