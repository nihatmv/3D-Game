import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, ShaderMaterial, UniformsLib, UniformsUtils, Vector2 } from 'three'
import { useIslandStore } from '../store/useIslandStore'
import { HALF, PALETTE, TileType } from '../world/constants'
import { idx, inBounds } from '../world/grid'
import {
  SHORE_EXTENT,
  SHORE_MAX_DIST,
  SHORE_MIN,
  createShoreTexture,
  updateShoreTexture,
} from '../world/shoreField'
import { SUNSET_PALETTE, sunset } from './story/sunset'

const DEEP_DAY = new Color(PALETTE.deepWater)
const DEEP_EVE = new Color(SUNSET_PALETTE.deepWater)
const SHALLOW_DAY = new Color(PALETTE.water)
const SHALLOW_EVE = new Color(SUNSET_PALETTE.water)
const FOAM_DAY = new Color('#f6fbf4')
const FOAM_EVE = new Color(SUNSET_PALETTE.foam)

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uShore;
  uniform vec2 uShoreMin;
  uniform float uShoreExtent;
  varying vec3 vWorld;
  #include <fog_pars_vertex>

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float d = texture2D(uShore, (wp.xz - uShoreMin) / uShoreExtent).r;
    float calm = smoothstep(0.02, 0.4, d);
    float w = sin(wp.x * 0.35 + uTime * 0.9) * 0.5
            + sin(wp.z * 0.45 - uTime * 0.7) * 0.35
            + sin((wp.x + wp.z) * 0.8 + uTime * 1.3) * 0.15;
    wp.y += w * 0.07 * calm;
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uShore;
  uniform vec2 uShoreMin;
  uniform float uShoreExtent;
  uniform float uMaxDist;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  varying vec3 vWorld;
  #include <fog_pars_fragment>

  void main() {
    float d = texture2D(uShore, (vWorld.xz - uShoreMin) / uShoreExtent).r;
    // Fully inside land (incl. inland ponds): don't draw the sea under it.
    if (d < 0.5 / 255.0) discard;
    float units = d * uMaxDist;

    float shallow = 1.0 - smoothstep(0.0, 3.2, units);
    vec3 col = mix(uDeep, uShallow, shallow);

    // Soft, irregular ripples for a bit of life on the surface.
    vec2 p = vWorld.xz;
    float rip = sin(dot(p, vec2(0.61, 0.79)) * 0.9 + uTime * 0.8)
              + sin(dot(p, vec2(-0.83, 0.55)) * 1.3 - uTime * 0.6)
              + sin(dot(p, vec2(0.21, -0.97)) * 2.1 + uTime * 1.1) * 0.5;
    col += smoothstep(1.4, 2.4, rip) * 0.06;
    // Deepen slightly with distance from the island.
    col = mix(col, uDeep * 0.85, smoothstep(0.6, 1.0, d) * 0.5);

    // Foam: a rim hugging the coast plus gentle bands drifting outward.
    float rim = 1.0 - smoothstep(0.08, 0.4, units);
    float bandWave = sin(units * 5.0 - uTime * 1.6) * 0.5 + 0.5;
    float band = smoothstep(0.8, 1.0, bandWave) * (1.0 - smoothstep(0.35, 1.5, units));
    float foam = max(rim, band * 0.7);
    col = mix(col, uFoam, foam * 0.85);

    float alpha = max(mix(0.94, 0.74, shallow), foam);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

export function Ocean() {
  const terrainVersion = useIslandStore((s) => s.terrainVersion)
  const shoreTex = useMemo(() => createShoreTexture(), [])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        fog: true,
        uniforms: UniformsUtils.merge([
          UniformsLib.fog,
          {
            uTime: { value: 0 },
            uShore: { value: null },
            uShoreMin: { value: new Vector2(SHORE_MIN, SHORE_MIN) },
            uShoreExtent: { value: SHORE_EXTENT },
            uMaxDist: { value: SHORE_MAX_DIST },
            uDeep: { value: DEEP_DAY.clone() },
            uShallow: { value: SHALLOW_DAY.clone() },
            uFoam: { value: FOAM_DAY.clone() },
          },
        ]),
      }),
    [],
  )
  // UniformsUtils.merge clones textures, so assign the live one afterwards.
  material.uniforms.uShore.value = shoreTex

  useEffect(() => {
    const { field, type, pondLevel } = useIslandStore.getState()
    // Water tiles without their own pond surface have joined the sea.
    const isSea = (wx: number, wz: number) => {
      const x = Math.floor(wx + HALF)
      const z = Math.floor(wz + HALF)
      if (!inBounds(x, z)) return false
      const i = idx(x, z)
      return type[i] === TileType.Water && Number.isNaN(pondLevel[i])
    }
    updateShoreTexture(shoreTex, field, isSea)
  }, [terrainVersion, shoreTex])

  useEffect(() => () => {
    material.dispose()
    shoreTex.dispose()
  }, [material, shoreTex])

  const lastSunset = useRef(0)
  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt
    // Warm the water along with the sky at the end of the story.
    if (sunset.t !== lastSunset.current) {
      lastSunset.current = sunset.t
      const k = sunset.t * sunset.t * (3 - 2 * sunset.t)
      const u = material.uniforms
      u.uDeep.value.lerpColors(DEEP_DAY, DEEP_EVE, k)
      u.uShallow.value.lerpColors(SHALLOW_DAY, SHALLOW_EVE, k)
      u.uFoam.value.lerpColors(FOAM_DAY, FOAM_EVE, k)
    }
  })

  return (
    <mesh rotation-x={-Math.PI / 2} material={material} name="ocean" renderOrder={1}>
      <planeGeometry args={[300, 300, 96, 96]} />
    </mesh>
  )
}
