import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Mesh, ShaderMaterial, Vector3 } from 'three'
import { useIslandStore } from '../store/useIslandStore'
import { SEA_Y, surfaceY, tileMin } from '../world/constants'
import { idx } from '../world/grid'
import { stackHeight } from '../world/stones'
import { canApply } from '../world/toolRules'
import { isRemoveMode } from './modifiers'
import { isLandmarkHovered } from './story/landmarkHover'
import { useThree } from '@react-three/fiber'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;

  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = vUv - 0.5;
    float d = roundedBox(p, vec2(0.46), 0.14);
    float fill = (1.0 - smoothstep(-0.02, 0.0, d)) * 0.22;
    float ring = (1.0 - smoothstep(0.0, 0.035, abs(d + 0.03))) * 0.75;
    float pulse = 0.85 + 0.15 * sin(uTime * 3.0);
    gl_FragColor = vec4(uColor, (fill + ring) * pulse * uOpacity);
  }
`

const target = new Vector3()

/** Highlight colours: can apply, shift/remove mode, and nothing-to-do. */
const COLOR_OK = new Color(1.0, 0.98, 0.92)
const COLOR_REMOVE = new Color(1.0, 0.7, 0.38)
const COLOR_INVALID = new Color(0.95, 0.3, 0.3)

/** Soft rounded-square glow that eases onto the hovered tile. */
export function HoverHighlight() {
  const ref = useRef<Mesh>(null)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: COLOR_OK.clone() } },
      }),
    [],
  )

  const canvas = useThree((s) => s.gl.domElement)

  useFrame((state, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const st = useIslandStore.getState()
    const { hover, height, type, pondLevel, stones } = st
    material.uniforms.uTime.value = state.clock.elapsedTime
    const k = 1 - Math.exp(-dt * 20)
    const targetOpacity = hover ? 1 : 0
    material.uniforms.uOpacity.value += (targetOpacity - material.uniforms.uOpacity.value) * k
    if (!hover) {
      const cursor = isLandmarkHovered() ? 'pointer' : ''
      if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor
      return
    }
    const reverse = isRemoveMode()
    const ok = canApply(st, st.tool, reverse, hover.x, hover.z)
    const tint = !ok ? COLOR_INVALID : reverse ? COLOR_REMOVE : COLOR_OK
    material.uniforms.uColor.value.lerp(tint, k)
    const cursor = ok ? 'pointer' : 'not-allowed'
    if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor
    const i = idx(hover.x, hover.z)
    const h = height[i]
    const pond = pondLevel[i]
    const tx = tileMin(hover.x) + 0.5
    const tz = tileMin(hover.z) + 0.5
    const ty = !Number.isNaN(pond)
      ? pond + 0.03
      : h > 0
        ? surfaceY(h, type[i]) + stackHeight(stones[i]) + 0.03
        : SEA_Y + 0.09
    target.set(tx, ty, tz)
    if (material.uniforms.uOpacity.value < 0.05) mesh.position.copy(target)
    else mesh.position.lerp(target, k)
  })

  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} material={material} renderOrder={5}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
