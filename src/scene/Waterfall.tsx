import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  IcosahedronGeometry,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { useIslandStore } from '../store/useIslandStore'
import { PALETTE, tileMin, topY } from '../world/constants'
import { HIGHLAND, HIGHLAND_X, HIGHLAND_Z, DECOR_FALLS } from '../world/decor'
import { idx } from '../world/grid'
import { isLowPower } from './perf'
import { NIGHT_PALETTE, SUNSET_PALETTE, tod } from './timeOfDay'

/**
 * The waterfall off the highland (DECOR_FALLS): a sheet that slides over the
 * lip and down the cliff into the plunge pool, a churning foam pad where it
 * lands, and a few mist puffs. Everything moves in the shaders from one time
 * uniform, like the ponds, so it costs no CPU work per frame beyond that.
 */

const { x: FX, z: FZ, width: FW } = DECOR_FALLS
const LEVEL = Number(HIGHLAND[FZ - HIGHLAND_Z][FX - HIGHLAND_X])
/** World-space lip: the +z edge of the falls' tiles, and the plateau top. */
const LIP_Z = tileMin(FZ) + 1
const TOP_Y = topY(LEVEL)
const CX = tileMin(FX) + FW / 2
/** The sheet is a little narrower than its tiles, so the rounded banks frame it. */
const HALF_W = FW / 2 - 0.3

/** The sheet's side profile, top to bottom: [z offset from the lip, y]. */
function profile(bottomY: number): Array<[number, number]> {
  const h = TOP_Y - bottomY
  return [
    [-0.4, TOP_Y + 0.02],
    [-0.15, TOP_Y + 0.025],
    [0.04, TOP_Y + 0.01],
    // Pours clear of the bevelled edge, then falls nearly straight.
    [0.16, TOP_Y - 0.08],
    [0.24, TOP_Y - 0.3],
    [0.28, TOP_Y - h * 0.55],
    [0.3, bottomY + 0.02],
  ]
}

/** A grid strip following the profile; uv.y runs along the flow (0 at the top). */
function sheetGeometry(bottomY: number): BufferGeometry {
  const prof = profile(bottomY)
  // Arc length along the profile, for evenly scrolling streaks.
  const len = [0]
  for (let i = 1; i < prof.length; i++) {
    len.push(len[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]))
  }
  const total = len[len.length - 1]
  const COLS = 10
  const pos: number[] = []
  const uv: number[] = []
  for (let r = 0; r < prof.length; r++) {
    for (let c = 0; c <= COLS; c++) {
      const u = c / COLS
      // Wider where it lands, as falling water spreads.
      const w = HALF_W * (1 + 0.12 * (len[r] / total))
      pos.push(CX + (u * 2 - 1) * w, prof[r][1], LIP_Z + prof[r][0])
      uv.push(u, len[r])
    }
  }
  const index: number[] = []
  for (let r = 0; r < prof.length - 1; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = r * (COLS + 1) + c
      const b = a + COLS + 1
      index.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  geo.setIndex(index)
  geo.computeBoundingSphere()
  return geo
}

/** Flat pad on the pool surface where the water lands. */
function foamGeometry(y: number): BufferGeometry {
  const x0 = CX - HALF_W - 0.35
  const x1 = CX + HALF_W + 0.35
  const z0 = LIP_Z
  const z1 = LIP_Z + 1.3
  const geo = new BufferGeometry()
  geo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1]), 3),
  )
  geo.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]), 2))
  geo.computeBoundingSphere()
  return geo
}

/** The spring on the plateau that feeds the falls: a flat oval just behind the lip. */
function springGeometry(): BufferGeometry {
  const geo = new CircleGeometry(1, 20)
  geo.rotateX(-Math.PI / 2)
  geo.scale(HALF_W * 0.85, 1, 0.3)
  geo.translate(CX, TOP_Y + 0.022, LIP_Z - 0.32)
  return geo
}

const MIST = 6

/** Mist puffs merged into one mesh; `aPuff` = (phase, x spread) drives each in the shader. */
function mistGeometry(y: number): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (let k = 0; k < MIST; k++) {
    const g = new IcosahedronGeometry(1, 1)
    g.deleteAttribute('uv')
    const n = g.getAttribute('position').count
    const puff = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      puff[i * 3] = k / MIST
      puff[i * 3 + 1] = CX + ((k * 0.618) % 1 - 0.5) * 2 * HALF_W
      puff[i * 3 + 2] = y
    }
    g.setAttribute('aPuff', new BufferAttribute(puff, 3))
    parts.push(g)
  }
  const geo = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  // The shader moves the puffs; keep culling from hiding them.
  geo.computeBoundingSphere()
  geo.boundingSphere!.center.set(CX, y + 0.4, LIP_Z + 0.4)
  geo.boundingSphere!.radius = 2
  return geo
}

const sheetVertex = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const sheetFragment = /* glsl */ `
  uniform float uTime;
  uniform float uLen;
  uniform vec3 uColor;
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  varying vec2 vUv;
  #include <fog_pars_fragment>

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float along = vUv.y;
    float t = along / uLen;
    // Long strands: noise stretched along the flow, scrolling down (faster lower down).
    float flow = along * 1.4 - uTime * (1.3 + t * 1.2);
    float strands = noise(vec2(vUv.x * 18.0, flow)) * 0.65 + noise(vec2(vUv.x * 41.0, flow * 2.3)) * 0.35;
    float streak = smoothstep(0.52, 0.8, strands);
    vec3 col = mix(uColor, uDeep, 0.25 + 0.35 * noise(vec2(vUv.x * 6.0, 0.5)));
    col = mix(col, uFoam, streak * 0.8);
    // White where it tips over the lip and where it churns at the bottom.
    float lip = smoothstep(0.25, 0.45, along) * (1.0 - smoothstep(0.45, 0.7, along));
    float base = smoothstep(0.72, 1.0, t);
    col = mix(col, uFoam, max(lip * 0.5, base * 0.8));
    // Soft sides, and fade in from the spring on the plateau.
    float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(0.0, 0.14, 1.0 - vUv.x);
    float alpha = edge * smoothstep(0.0, 0.2, along) * (0.88 + 0.12 * streak);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

const foamFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFoam;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    // Distance from where the water lands (the top edge, centred).
    vec2 p = vec2((vUv.x - 0.5) * 1.6, vUv.y);
    float d = length(p);
    float rings = 0.5 + 0.5 * sin(d * 22.0 - uTime * 4.0);
    float churn = 0.5 + 0.5 * sin(vUv.x * 31.0 + uTime * 5.0) * sin(vUv.y * 17.0 - uTime * 3.0);
    float a = (1.0 - smoothstep(0.15, 0.95, d)) * (0.45 + 0.35 * rings + 0.2 * churn);
    a *= smoothstep(0.0, 0.12, vUv.x) * smoothstep(0.0, 0.12, 1.0 - vUv.x);
    gl_FragColor = vec4(uFoam, a * 0.85);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

const springFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    // Circle uvs: centre at 0.5. Rings bubble out from the middle.
    float d = length(vUv - 0.5) * 2.0;
    vec3 col = mix(uDeep, uColor, 0.55 + 0.45 * smoothstep(0.0, 0.9, d));
    float rings = smoothstep(0.8, 1.0, 0.5 + 0.5 * sin(d * 9.0 - uTime * 2.0));
    col = mix(col, uFoam, max(rings * 0.15, smoothstep(0.85, 1.0, d) * 0.5));
    gl_FragColor = vec4(col, 0.9 * (1.0 - smoothstep(0.9, 1.0, d)));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

const mistVertex = /* glsl */ `
  uniform float uTime;
  attribute vec3 aPuff;
  varying float vFade;
  #include <fog_pars_vertex>
  void main() {
    // Each puff rises, swells and fades on its own loop, then starts again.
    float k = fract(uTime * 0.35 + aPuff.x);
    float size = 0.06 + 0.14 * k;
    vec3 c = vec3(aPuff.y + sin(aPuff.x * 40.0 + uTime) * 0.08, aPuff.z + 0.04 + k * 0.45, ${LIP_Z.toFixed(3)} + 0.25 + k * 0.45);
    vFade = sin(k * 3.14159);
    vec4 mvPosition = viewMatrix * vec4(c + position * size, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const mistFragment = /* glsl */ `
  uniform vec3 uFoam;
  varying float vFade;
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(uFoam, vFade * 0.3);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

const uvVertex = sheetVertex

const FOAM_DAY = new Color('#f6fbf4')
const FOAM_EVE = new Color(SUNSET_PALETTE.foam)
const WATER_DAY = new Color(PALETTE.water).multiplyScalar(1.08)
const WATER_EVE = new Color(SUNSET_PALETTE.water)
const WATER_NIGHT = new Color(NIGHT_PALETTE.fall)
const FOAM_NIGHT = new Color(NIGHT_PALETTE.foam)

function material(vertexShader: string, fragmentShader: string, extra: Record<string, { value: unknown }>) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    fog: true,
    side: DoubleSide,
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 }, uFoam: { value: FOAM_DAY.clone() }, ...extra }]),
  })
}

export function Waterfall() {
  // The pool is locked, so its level never changes after load.
  const poolY = useMemo(() => {
    const { pondLevel } = useIslandStore.getState()
    const y = pondLevel[idx(FX + 1, FZ + 1)]
    return Number.isNaN(y) ? topY(2) - 0.1 : y
  }, [])

  const sheet = useMemo(() => sheetGeometry(poolY), [poolY])
  const foam = useMemo(() => foamGeometry(poolY + 0.012), [poolY])
  const mist = useMemo(() => mistGeometry(poolY), [poolY])
  const spring = useMemo(() => springGeometry(), [])
  const mats = useMemo(() => {
    const len = sheet.getAttribute('uv').getY(sheet.getAttribute('uv').count - 1)
    return {
      sheet: material(sheetVertex, sheetFragment, {
        uLen: { value: len },
        uColor: { value: WATER_DAY.clone() },
        uDeep: { value: new Color(PALETTE.deepWater) },
      }),
      foam: material(uvVertex, foamFragment, {}),
      spring: material(uvVertex, springFragment, {
        uColor: { value: WATER_DAY.clone() },
        uDeep: { value: new Color(PALETTE.deepWater) },
      }),
      mist: material(mistVertex, mistFragment, {}),
    }
  }, [sheet])

  useEffect(
    () => () => {
      for (const g of [sheet, foam, mist, spring]) g.dispose()
      for (const m of Object.values(mats)) m.dispose()
    },
    [sheet, foam, mist, spring, mats],
  )

  const mistMesh = useRef<Mesh>(null)
  const lastTod = useRef(-1)
  useFrame((_, dt) => {
    for (const m of Object.values(mats)) m.uniforms.uTime.value += dt
    if (mistMesh.current) mistMesh.current.visible = !isLowPower()
    if (tod.version !== lastTod.current) {
      lastTod.current = tod.version
      const { warm, night } = tod
      mats.sheet.uniforms.uColor.value.lerpColors(WATER_DAY, WATER_EVE, warm * 0.6).lerp(WATER_NIGHT, night)
      mats.spring.uniforms.uColor.value.copy(mats.sheet.uniforms.uColor.value)
      for (const m of Object.values(mats)) m.uniforms.uFoam.value.lerpColors(FOAM_DAY, FOAM_EVE, warm).lerp(FOAM_NIGHT, night)
    }
  })

  // Not pickable: clicks go through to the tiles (which are locked anyway).
  return (
    <group>
      <mesh geometry={sheet} material={mats.sheet} renderOrder={3} raycast={() => null} />
      <mesh geometry={foam} material={mats.foam} renderOrder={3} raycast={() => null} />
      <mesh geometry={spring} material={mats.spring} renderOrder={2} raycast={() => null} />
      <mesh ref={mistMesh} geometry={mist} material={mats.mist} renderOrder={4} raycast={() => null} />
    </group>
  )
}
