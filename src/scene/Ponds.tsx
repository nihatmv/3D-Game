import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  LinearFilter,
  RedFormat,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  UnsignedByteType,
} from 'three'
import { useIslandStore } from '../store/useIslandStore'
import { GRID, PALETTE, tileMin } from '../world/constants'
import { idx, inBounds } from '../world/grid'
import { EXTENT, NS, ORIGIN } from '../world/terrainField'

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  #include <fog_pars_vertex>

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  uniform sampler2D uHeights;
  uniform float uOrigin;
  uniform float uExtent;
  varying vec3 vWorld;
  #include <fog_pars_fragment>

  void main() {
    // Ground height under this point (decoded from 0..1 -> -1..3 world units).
    float ground = texture2D(uHeights, (vWorld.xz - uOrigin) / uExtent).r * 4.0 - 1.0;
    float depth = vWorld.y - ground;

    vec3 col = mix(uColor, uDeep, smoothstep(0.08, 0.45, depth) * 0.45);

    vec2 p = vWorld.xz;
    float rip = sin(dot(p, vec2(0.7, 0.7)) * 3.1 + uTime * 1.2)
              + sin(dot(p, vec2(-0.6, 0.8)) * 4.3 - uTime * 0.9);
    col += smoothstep(1.2, 1.9, rip) * 0.08;

    // Foam hugs the (curved) bank, with a soft ripple ring just inside it.
    float foam = 1.0 - smoothstep(0.02, 0.1, depth);
    foam = max(foam, (1.0 - smoothstep(0.08, 0.22, depth)) * (0.5 + 0.5 * sin(depth * 45.0 - uTime * 2.0)) * 0.35);
    col = mix(col, uFoam, foam * 0.8);

    gl_FragColor = vec4(col, max(0.82, foam));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

/** Water tucks this far under neighbouring land, filling the banks' rounded corners. */
const TUCK = 0.3

/** One quad per wet pond tile, stretched under any land it borders. */
function buildPondGeometry(pondLevel: Float32Array, height: Uint8Array): BufferGeometry {
  const pos: number[] = []
  const wet = (x: number, z: number) => inBounds(x, z) && !Number.isNaN(pondLevel[idx(x, z)])
  // Only tuck under land, never over the ocean (it would z-fight the sea surface).
  const land = (x: number, z: number) => inBounds(x, z) && height[idx(x, z)] > 0 && !wet(x, z)

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const y = pondLevel[idx(x, z)]
      if (Number.isNaN(y)) continue
      const x0 = tileMin(x) - (land(x - 1, z) ? TUCK : 0)
      const x1 = tileMin(x) + 1 + (land(x + 1, z) ? TUCK : 0)
      const z0 = tileMin(z) - (land(x, z - 1) ? TUCK : 0)
      const z1 = tileMin(z) + 1 + (land(x, z + 1) ? TUCK : 0)
      // Two triangles, counter-clockwise when seen from above.
      pos.push(x0, y, z0, x0, y, z1, x1, y, z0)
      pos.push(x1, y, z0, x0, y, z1, x1, y, z1)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.computeBoundingSphere()
  return geo
}

export function Ponds() {
  const terrainVersion = useIslandStore((s) => s.terrainVersion)

  const geometry = useMemo(() => {
    const { pondLevel, height } = useIslandStore.getState()
    return buildPondGeometry(pondLevel, height)
  }, [terrainVersion])

  // Ground heights for depth tint and bank foam, packed into 8 bits.
  const heightTex = useMemo(() => {
    const tex = new DataTexture(new Uint8Array(NS * NS), NS, NS, RedFormat, UnsignedByteType)
    tex.magFilter = tex.minFilter = LinearFilter
    tex.wrapS = tex.wrapT = ClampToEdgeWrapping
    return tex
  }, [])
  useEffect(() => {
    const heights = useIslandStore.getState().field.heights
    const data = heightTex.image.data as Uint8Array
    for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, ((heights[i] + 1) / 4) * 255))
    heightTex.needsUpdate = true
  }, [terrainVersion, heightTex])
  useEffect(() => () => heightTex.dispose(), [heightTex])
  useEffect(() => () => geometry.dispose(), [geometry])

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
            uColor: { value: new Color(PALETTE.water).multiplyScalar(1.08) },
            uDeep: { value: new Color(PALETTE.deepWater) },
            uFoam: { value: new Color('#f6fbf4') },
            uHeights: { value: null },
            uOrigin: { value: ORIGIN },
            uExtent: { value: EXTENT },
          },
        ]),
      }),
    [],
  )
  // UniformsUtils.merge clones textures, so assign the live one afterwards.
  material.uniforms.uHeights.value = heightTex
  useEffect(() => () => material.dispose(), [material])

  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt
  })

  // Pickable, so hovering the water selects the pond tile, not the bank behind it.
  return <mesh geometry={geometry} material={material} renderOrder={2} name="pond" />
}
