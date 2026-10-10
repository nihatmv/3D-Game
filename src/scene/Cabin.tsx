import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { HALF, topY } from '../world/constants'
import { DECOR_CABIN, HIGHLAND, HIGHLAND_X, HIGHLAND_Z } from '../world/decor'
import { CHIMNEY_TOP, cabinGeometry, cabinLightsGeometry } from './decorGeometry'
import { riseOfKind } from '../story/scrollDirector'
import { makeBuildMaterial } from './buildMaterial'
import { isLowPower, requestShadowUpdate } from './perf'
import { tod } from './timeOfDay'

/**
 * The old wooden cabin on the highland shelf (DECOR_CABIN), mounted once its
 * tour stop is built (Scene): it rises from the ground, then stands still. One
 * merged mesh, windows and a lantern that glow warm from sunset into the night,
 * and chimney smoke animated in its shader (hidden on slow machines).
 */

const { x: TX, z: TZ, rot: ROT } = DECOR_CABIN
const LEVEL = Number(HIGHLAND[Math.floor(TZ) - HIGHLAND_Z][Math.floor(TX) - HIGHLAND_X])
const POS: [number, number, number] = [TX - HALF + 0.5, topY(LEVEL), TZ - HALF + 0.5]

const PUFFS = 5

function smokeGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (let k = 0; k < PUFFS; k++) {
    const g = new IcosahedronGeometry(1, 1)
    g.deleteAttribute('uv')
    g.deleteAttribute('normal')
    g.setAttribute('aPhase', new BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(k / PUFFS), 1))
    parts.push(g)
  }
  const geo = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  geo.computeBoundingSphere()
  geo.boundingSphere!.center.set(CHIMNEY_TOP[0] + 0.3, CHIMNEY_TOP[1] + 0.6, CHIMNEY_TOP[2])
  geo.boundingSphere!.radius = 1.2
  return geo
}

const smokeVertex = /* glsl */ `
  uniform float uTime;
  attribute float aPhase;
  varying float vFade;
  #include <fog_pars_vertex>
  void main() {
    // Each puff rises from the chimney, drifts with the breeze, swells and fades, then loops.
    float k = fract(uTime * 0.16 + aPhase);
    float size = 0.07 + 0.15 * k;
    vec3 c = vec3(${CHIMNEY_TOP[0].toFixed(3)} + k * k * 0.5 + sin(aPhase * 30.0 + uTime * 0.7) * 0.04,
                  ${CHIMNEY_TOP[1].toFixed(3)} + 0.05 + k * 1.0,
                  ${CHIMNEY_TOP[2].toFixed(3)} - k * 0.15);
    vFade = smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.55, 1.0, k));
    vec4 mvPosition = modelViewMatrix * vec4(c + position * size, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const smokeFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vFade;
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(uColor, vFade * 0.55);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

const GLASS_DAY = new Color('#5d6f78')
const GLASS_EVE = new Color('#ffcf85')
const GLOW = new Color('#ffb257')

export function Cabin() {
  const body = useMemo(() => cabinGeometry(), [])
  const lights = useMemo(() => cabinLightsGeometry(), [])
  const smoke = useMemo(() => smokeGeometry(), [])
  const { material: bodyMat, progress } = useMemo(makeBuildMaterial, [])
  const lightMat = useMemo(() => new MeshLambertMaterial({ color: GLASS_DAY.clone(), emissive: GLOW, emissiveIntensity: 0 }), [])
  const smokeMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: smokeVertex,
        fragmentShader: smokeFragment,
        transparent: true,
        depthWrite: false,
        fog: true,
        uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 }, uColor: { value: new Color('#f4efe8') } }]),
      }),
    [],
  )
  useEffect(
    () => () => {
      for (const g of [body, lights, smoke]) g.dispose()
      for (const m of [bodyMat, lightMat, smokeMat]) m.dispose()
    },
    [body, lights, smoke, bodyMat, lightMat, smokeMat],
  )

  const bodyMesh = useRef<Mesh>(null)
  const lightsMesh = useRef<Mesh>(null)
  const risen = useRef(-1)
  const smokeMesh = useRef<Mesh>(null)
  const lastTod = useRef(-1)
  useFrame((_, dt) => {
    // Log by log with the scroll (in the material's shader); the windows and its shadow once it stands.
    const t = riseOfKind('cabin')
    if (t !== risen.current) {
      const was = risen.current
      risen.current = t
      progress.value = t
      if (t >= 1 !== was >= 1 || was < 0) {
        if (bodyMesh.current) bodyMesh.current.castShadow = t >= 1
        if (lightsMesh.current) lightsMesh.current.visible = t >= 1
        requestShadowUpdate()
      }
    }
    smokeMat.uniforms.uTime.value += dt
    if (smokeMesh.current) smokeMesh.current.visible = t >= 1 && !isLowPower()
    if (tod.version !== lastTod.current) {
      lastTod.current = tod.version
      const k = tod.glow
      lightMat.color.lerpColors(GLASS_DAY, GLASS_EVE, k)
      lightMat.emissiveIntensity = k * 0.9
    }
  })

  return (
    <group position={POS} rotation-y={ROT}>
      <mesh ref={bodyMesh} geometry={body} material={bodyMat} receiveShadow raycast={() => null} />
      <mesh ref={lightsMesh} geometry={lights} material={lightMat} visible={false} raycast={() => null} />
      <mesh ref={smokeMesh} geometry={smoke} material={smokeMat} renderOrder={4} raycast={() => null} />
    </group>
  )
}
