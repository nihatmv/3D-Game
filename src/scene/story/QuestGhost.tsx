import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Group, MeshBasicMaterial, ShaderMaterial } from 'three'
import { useIslandStore } from '../../store/useIslandStore'
import { selectActiveQuest, useStoryStore } from '../../store/useStoryStore'
import { tilesInArea, type Area } from '../../story/quests'
import { HALF, SEA_Y, surfaceY } from '../../world/constants'
import { stackHeight } from '../../world/stones'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** Bright golden disc with a dashed turning rim and two "sonar" waves running outward. */
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  float wave(float d, float t) {
    float w = fract(t);
    return (1.0 - smoothstep(0.0, 0.035, abs(d - w * 0.47))) * (1.0 - w);
  }

  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p);
    float a = atan(p.y, p.x);
    float dash = step(0.0, sin(a * 14.0 + uTime * 1.4));
    float rim = (1.0 - smoothstep(0.0, 0.028, abs(d - 0.455))) * mix(0.55, 1.0, dash);
    float fill = (1.0 - smoothstep(0.15, 0.47, d)) * 0.5;
    float waves = (wave(d, uTime * 0.7) + wave(d, uTime * 0.7 + 0.5)) * 0.9;
    float pulse = 0.85 + 0.15 * sin(uTime * 3.2);
    vec3 color = mix(vec3(1.0, 0.78, 0.35), vec3(1.0, 0.95, 0.7), waves);
    gl_FragColor = vec4(color, min(1.0, (rim + fill + waves) * pulse) * uOpacity);
  }
`

/** Highest visible ground (or water) in the area, so the ring floats over it. */
function areaTop(a: Area): number {
  const { height, type, pondLevel } = useIslandStore.getState()
  let top = SEA_Y
  for (const i of tilesInArea(a)) {
    const pond = pondLevel[i]
    const y = !Number.isNaN(pond) ? pond : height[i] > 0 ? surfaceY(height[i], type[i]) : SEA_Y
    top = Math.max(top, y)
  }
  return top
}

/** Tallest stone stack in the area, so the marker hovers above towers. */
function areaStack(a: Area): number {
  const { stones } = useIslandStore.getState()
  let h = 0
  for (const i of tilesInArea(a)) h = Math.max(h, stackHeight(stones[i]))
  return h
}

const BEAM_H = 5

/**
 * Glow over the stop the crew is heading to or starting on: a ring, a soft
 * light column and a bobbing marker. It only marks the spot (the scroll does
 * the building) and fades once the landmark is placed.
 */
export function QuestGhost() {
  const quest = useStoryStore((s) => {
    const q = selectActiveQuest(s)
    return q && !s.built.includes(q.id) ? q : null
  })
  const terrainVersion = useIslandStore((s) => s.terrainVersion)
  const stoneVersion = useIslandStore((s) => s.stoneVersion)
  const group = useRef<Group>(null)
  const marker = useRef<Group>(null)

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  const beam = useMemo(
    () => new MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  )
  useEffect(() => () => beam.dispose(), [beam])

  // Fade in afresh at each new spot.
  useEffect(() => {
    material.uniforms.uOpacity.value = 0
  }, [material, quest])

  const top = useMemo(() => (quest ? areaTop(quest.area) : 0), [quest, terrainVersion])
  const markerBase = useMemo(() => (quest ? 1.8 + areaStack(quest.area) : 0), [quest, stoneVersion])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    material.uniforms.uTime.value = t
    const o = material.uniforms.uOpacity.value + (1 - material.uniforms.uOpacity.value) * (1 - Math.exp(-dt * 6))
    material.uniforms.uOpacity.value = o
    g.visible = o > 0.01
    beam.opacity = o * (0.3 + 0.1 * Math.sin(t * 3.2))
    if (marker.current) {
      marker.current.position.y = markerBase + Math.sin(t * 2.6) * 0.25
      marker.current.rotation.y = t * 1.2
      marker.current.scale.setScalar(Math.max(0.001, o))
    }
  })

  if (!quest) return null
  const { x, z, r } = quest.area
  const size = (r + 0.5) * 2

  return (
    <group ref={group} key={quest.id} position={[x - HALF + 0.5, top + 0.04, z - HALF + 0.5]}>
      <mesh rotation-x={-Math.PI / 2} material={material} renderOrder={4} raycast={() => null}>
        <planeGeometry args={[size, size]} />
      </mesh>
      <mesh position-y={BEAM_H / 2} material={beam} renderOrder={5} raycast={() => null}>
        <cylinderGeometry args={[r * 0.55, r * 0.75, BEAM_H, 20, 1, true]} />
      </mesh>
      <group ref={marker}>
        <mesh rotation-x={Math.PI} scale={[0.36, 0.56, 0.36]} raycast={() => null}>
          <octahedronGeometry args={[1, 0]} />
          <meshLambertMaterial color="#ffc861" emissive="#f0a040" emissiveIntensity={0.9} flatShading />
        </mesh>
      </group>
    </group>
  )
}
