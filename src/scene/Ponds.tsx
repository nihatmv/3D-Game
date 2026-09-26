import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, ShaderMaterial, UniformsLib, UniformsUtils } from 'three'
import { useIslandStore } from '../store/useIslandStore'
import { GRID, PALETTE, tileMin } from '../world/constants'
import { idx, inBounds } from '../world/grid'

const vertexShader = /* glsl */ `
  attribute vec2 aLocal;
  attribute vec4 aBank;
  varying vec2 vLocal;
  varying vec4 vBank;
  varying vec3 vWorld;
  #include <fog_pars_vertex>

  void main() {
    vLocal = aLocal;
    vBank = aBank;
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
  varying vec2 vLocal;
  varying vec4 vBank;
  varying vec3 vWorld;
  #include <fog_pars_fragment>

  void main() {
    // Distance (in tile units) to the nearest edge that touches a bank.
    float e = 1.0;
    if (vBank.x > 0.5) e = min(e, vLocal.x);
    if (vBank.y > 0.5) e = min(e, 1.0 - vLocal.x);
    if (vBank.z > 0.5) e = min(e, vLocal.y);
    if (vBank.w > 0.5) e = min(e, 1.0 - vLocal.y);

    vec3 col = mix(uColor, uDeep, smoothstep(0.1, 0.6, e) * 0.45);

    vec2 p = vWorld.xz;
    float rip = sin(dot(p, vec2(0.7, 0.7)) * 3.1 + uTime * 1.2)
              + sin(dot(p, vec2(-0.6, 0.8)) * 4.3 - uTime * 0.9);
    col += smoothstep(1.2, 1.9, rip) * 0.08;

    float foam = 1.0 - smoothstep(0.03, 0.12, e);
    foam = max(foam, (1.0 - smoothstep(0.1, 0.3, e)) * (0.5 + 0.5 * sin(e * 40.0 - uTime * 2.0)) * 0.35);
    col = mix(col, uFoam, foam * 0.8);

    gl_FragColor = vec4(col, max(0.82, foam));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

/** Builds one quad per wet pond tile, with a per-tile bank mask for foam. */
function buildPondGeometry(pondLevel: Float32Array): BufferGeometry {
  const pos: number[] = []
  const local: number[] = []
  const bank: number[] = []
  const wet = (x: number, z: number) => inBounds(x, z) && !Number.isNaN(pondLevel[idx(x, z)])

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const y = pondLevel[idx(x, z)]
      if (Number.isNaN(y)) continue
      const x0 = tileMin(x)
      const z0 = tileMin(z)
      const b = [wet(x - 1, z) ? 0 : 1, wet(x + 1, z) ? 0 : 1, wet(x, z - 1) ? 0 : 1, wet(x, z + 1) ? 0 : 1]
      // Two triangles, counter-clockwise when seen from above.
      const corners = [
        [0, 0], [0, 1], [1, 0],
        [1, 0], [0, 1], [1, 1],
      ]
      for (const [u, v] of corners) {
        pos.push(x0 + u, y, z0 + v)
        local.push(u, v)
        bank.push(b[0], b[1], b[2], b[3])
      }
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('aLocal', new BufferAttribute(new Float32Array(local), 2))
  geo.setAttribute('aBank', new BufferAttribute(new Float32Array(bank), 4))
  geo.computeBoundingSphere()
  return geo
}

export function Ponds() {
  const terrainVersion = useIslandStore((s) => s.terrainVersion)

  const geometry = useMemo(
    () => buildPondGeometry(useIslandStore.getState().pondLevel),
    [terrainVersion],
  )
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
          },
        ]),
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt
  })

  // Pickable, so hovering the water selects the pond tile, not the bank behind it.
  return <mesh geometry={geometry} material={material} renderOrder={2} name="pond" />
}
