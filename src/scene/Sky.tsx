import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  PlaneGeometry,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { isLowPower } from './perf'
import { tod } from './timeOfDay'

const DOME_RADIUS = 200
const BODY_DISTANCE = 180
const SUN_SIZE = 46
const MOON_SIZE = 24
const STAR_COUNT = 500

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const domeVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Horizon (= fog colour, so the sea fades into it seamlessly) up to the zenith,
// with a soft halo around the sun that only shows when it's low and warm.
const domeFragment = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uSunDir;
  uniform vec3 uHaloColor;
  uniform float uHalo;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, dir.y));
    float halo = pow(max(dot(dir, uSunDir), 0.0), 10.0) * uHalo * (1.0 - smoothstep(0.0, 0.5, dir.y));
    col = mix(col, uHaloColor, clamp(halo, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

const bodyVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// A disc with a soft glow; `uCraters` adds a few faint spots for the moon.
const bodyFragment = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uGlow;
  uniform float uOpacity;
  uniform float uRadius;
  uniform float uCraters;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float core = 1.0 - smoothstep(uRadius - 0.02, uRadius + 0.01, d);
    float glow = pow(max(1.0 - d, 0.0), 2.6) * 0.55;
    vec3 col = mix(uGlow, uCore, core);
    float spots = smoothstep(0.075, 0.05, length(p - vec2(0.05, 0.06) * uRadius * 4.0))
                + smoothstep(0.05, 0.03, length(p - vec2(-0.09, -0.04) * uRadius * 4.0))
                + smoothstep(0.035, 0.02, length(p - vec2(0.02, -0.12) * uRadius * 4.0));
    col *= 1.0 - spots * uCraters * core;
    gl_FragColor = vec4(col, max(core, glow) * uOpacity);
    #include <colorspace_fragment>
  }
`

function bodyMaterial(radius: number, craters: number) {
  return new ShaderMaterial({
    vertexShader: bodyVertex,
    fragmentShader: bodyFragment,
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uCore: { value: new Color() },
      uGlow: { value: new Color() },
      uOpacity: { value: 0 },
      uRadius: { value: radius },
      uCraters: { value: craters },
    },
  })
}

/** Points on the upper sky; a fixed seed so the constellations never change. */
function starGeometry() {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const pos: number[] = []
  const v = new Vector3()
  // Bunched toward the horizon: a camera tilted down only sees the lowest band of sky.
  for (let i = 0; i < STAR_COUNT; i++) {
    const y = 0.035 + 0.965 * rand() ** 2.5
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(1 - y * y)
    v.set(r * Math.cos(a), y, r * Math.sin(a)).multiplyScalar(DOME_RADIUS * 0.95)
    pos.push(v.x, v.y, v.z)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  return g
}

const SUN_CORE_DAY = new Color('#fff8e8')
const SUN_CORE_LOW = new Color('#fff0c4')
const SUN_GLOW_LOW = new Color('#ffa65c')
const MOON_CORE = new Color('#f3efe2')
const MOON_GLOW = new Color('#9fb2ea')

/**
 * The sky dome, sun, moon and stars. They follow the camera (so they sit at
 * infinity), draw before everything else and ignore fog. Uniforms change only
 * when the time of day does; the per-frame work is copying the camera pose.
 */
export function Sky() {
  const camera = useThree((s) => s.camera)
  const group = useRef<Group>(null)
  const sun = useRef<Mesh>(null)
  const moon = useRef<Mesh>(null)
  const stars = useRef<Points>(null)

  const res = useMemo(() => {
    const dome = new ShaderMaterial({
      vertexShader: domeVertex,
      fragmentShader: domeFragment,
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uHorizon: { value: new Color() },
        uZenith: { value: new Color() },
        uSunDir: { value: new Vector3() },
        uHaloColor: { value: new Color() },
        uHalo: { value: 0 },
      },
    })
    return {
      domeGeo: new SphereGeometry(DOME_RADIUS, 32, 16),
      plane: new PlaneGeometry(1, 1),
      starGeo: starGeometry(),
      dome,
      sun: bodyMaterial(0.2, 0),
      moon: bodyMaterial(0.42, 0.12),
      stars: new PointsMaterial({
        color: '#fff8ea',
        size: 2.2,
        sizeAttenuation: false,
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: AdditiveBlending,
      }),
    }
  }, [])

  useEffect(
    () => () => {
      for (const r of Object.values(res)) r.dispose()
    },
    [res],
  )

  const lastTod = useRef(-1)
  useFrame(() => {
    group.current?.position.copy(camera.position)
    sun.current?.quaternion.copy(camera.quaternion)
    moon.current?.quaternion.copy(camera.quaternion)
    if (stars.current) stars.current.visible = res.stars.opacity > 0.01 && !isLowPower()
    if (tod.version === lastTod.current) return
    lastTod.current = tod.version

    const d = res.dome.uniforms
    d.uHorizon.value.copy(tod.sky)
    d.uZenith.value.copy(tod.zenith)
    d.uSunDir.value.copy(tod.sun)
    d.uHaloColor.value.copy(tod.light).lerp(tod.sky, 0.2)
    d.uHalo.value = tod.warm * 0.85 * ss(-0.12, 0.02, tod.sun.y)

    const s = res.sun.uniforms
    s.uCore.value.lerpColors(SUN_CORE_DAY, SUN_CORE_LOW, tod.warm)
    s.uGlow.value.copy(tod.light).lerp(SUN_GLOW_LOW, tod.warm * 0.7)
    s.uOpacity.value = ss(-0.04, 0.03, tod.sun.y)
    sun.current?.position.copy(tod.sun).multiplyScalar(BODY_DISTANCE)
    if (sun.current) sun.current.visible = s.uOpacity.value > 0.001

    const m = res.moon.uniforms
    m.uCore.value.copy(MOON_CORE)
    m.uGlow.value.copy(MOON_GLOW)
    m.uOpacity.value = ss(-0.04, 0.05, tod.moon.y) * ss(0.15, 0.7, tod.night)
    moon.current?.position.copy(tod.moon).multiplyScalar(BODY_DISTANCE)
    if (moon.current) moon.current.visible = m.uOpacity.value > 0.001

    res.stars.opacity = ss(0.4, 1, tod.night) * 0.9
  })

  return (
    <group ref={group}>
      <mesh geometry={res.domeGeo} material={res.dome} renderOrder={-10} raycast={() => null} frustumCulled={false} />
      <points ref={stars} geometry={res.starGeo} material={res.stars} renderOrder={-9} raycast={() => null} frustumCulled={false} />
      <mesh ref={moon} geometry={res.plane} material={res.moon} scale={MOON_SIZE} renderOrder={-8} raycast={() => null} />
      <mesh ref={sun} geometry={res.plane} material={res.sun} scale={SUN_SIZE} renderOrder={-8} raycast={() => null} />
    </group>
  )
}
