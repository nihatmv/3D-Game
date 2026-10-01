import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, ShaderMaterial } from 'three'
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

/** Soft golden disc with a dashed rim that slowly turns. */
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p);
    float a = atan(p.y, p.x);
    float dash = step(0.0, sin(a * 14.0 + uTime * 1.4));
    float rim = (1.0 - smoothstep(0.0, 0.018, abs(d - 0.465))) * mix(0.35, 1.0, dash);
    float fill = (1.0 - smoothstep(0.3, 0.47, d)) * 0.18;
    float pulse = 0.8 + 0.2 * sin(uTime * 2.6);
    gl_FragColor = vec4(1.0, 0.82, 0.45, (rim + fill) * pulse * uOpacity);
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

/**
 * Glowing outline over the active quest's target area, plus a bobbing
 * marker above it, so the visitor never has to guess where to build.
 */
export function QuestGhost() {
  const quest = useStoryStore(selectActiveQuest)
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

  const top = useMemo(() => (quest ? areaTop(quest.area) : 0), [quest, terrainVersion])
  const markerBase = useMemo(() => (quest ? 1.4 + areaStack(quest.area) : 0), [quest, stoneVersion])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    material.uniforms.uTime.value = t
    const target = quest ? 1 : 0
    const o = material.uniforms.uOpacity.value + (target - material.uniforms.uOpacity.value) * (1 - Math.exp(-dt * 6))
    material.uniforms.uOpacity.value = o
    g.visible = o > 0.01
    if (marker.current) {
      marker.current.position.y = markerBase + Math.sin(t * 2.2) * 0.15
      marker.current.rotation.y = t * 1.2
      marker.current.scale.setScalar(Math.max(0.001, o))
    }
  })

  if (!quest) return <group ref={group} visible={false} />
  const { x, z, r } = quest.area
  const size = (r + 0.5) * 2

  return (
    <group ref={group} position={[x - HALF + 0.5, top + 0.04, z - HALF + 0.5]}>
      <mesh rotation-x={-Math.PI / 2} material={material} renderOrder={4} raycast={() => null}>
        <planeGeometry args={[size, size]} />
      </mesh>
      <group ref={marker}>
        <mesh rotation-x={Math.PI} scale={[0.22, 0.34, 0.22]} raycast={() => null}>
          <octahedronGeometry args={[1, 0]} />
          <meshLambertMaterial color="#ffc861" emissive="#e8913a" emissiveIntensity={0.55} flatShading />
        </mesh>
      </group>
    </group>
  )
}
