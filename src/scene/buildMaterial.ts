import { MeshLambertMaterial } from 'three'

/** Share of the build each part takes to settle; the parts' starts are spread over the rest. */
const SPAN = 0.22
/** How far above its place a part starts its drop. */
const DROP = 0.55

/**
 * The material of something that is built up piece by piece: a flat-shaded,
 * vertex-coloured Lambert whose vertex shader puts each part of a geometry made
 * with `build()` (geomUtil.ts: its `aPart` says where the part stands and when
 * its turn comes, bottom parts first) in place as `progress.value` runs from 0
 * to 1. A part drops in from just above, growing from its base with a little
 * overshoot. It all happens on the GPU from that one number, so scrubbing it
 * with the scroll costs nothing per frame; at 1 the mesh is exactly its geometry.
 * While it is being built it should not cast a shadow (the shadow pass knows
 * nothing of the missing parts): turn `castShadow` on once `progress` is 1.
 */
export function makeBuildMaterial(): { material: MeshLambertMaterial; progress: { value: number } } {
  const progress = { value: 0 }
  const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBuild = progress
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', 'attribute vec4 aPart;\nuniform float uBuild;\n#include <common>')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        float partK = clamp((uBuild - aPart.w * ${(1 - SPAN).toFixed(3)}) / ${SPAN.toFixed(3)}, 0.0, 1.0);
        float partU = partK - 1.0;
        // easeOutBack: 0 -> a little past 1 -> 1.
        float partE = 1.0 + 2.7 * partU * partU * partU + 1.7 * partU * partU;
        transformed = aPart.xyz + (transformed - aPart.xyz) * partE;
        transformed.y += partU * partU * ${DROP.toFixed(3)};`,
      )
  }
  // One program for every such material, whatever its progress.
  material.customProgramCacheKey = () => 'build-up'
  return { material, progress }
}
