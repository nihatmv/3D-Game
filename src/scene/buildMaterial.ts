import { MeshDepthMaterial, MeshLambertMaterial, type Material } from 'three'

/** Share of the build each part takes to settle; the parts' starts are spread over the rest. */
const SPAN = 0.22
/** How far above its place a part starts its drop. */
const DROP = 0.55
/** How far through a landmark's rise its last piece lands; the rest of the rise switches it on (finishAt). */
const PIECES_BY = 0.85

/** Build progress of the pieces (the material's `progress`) at rise `t` (0..1). */
export const piecesAt = (t: number) => Math.min(1, t / PIECES_BY)

/** After the last piece lands: how far the landmark has come to life (its lamp, ripples, butterflies), 0..1, eased. */
export function finishAt(t: number) {
  const k = Math.min(1, Math.max(0, (t - PIECES_BY) / (1 - PIECES_BY)))
  return k * k * (3 - 2 * k)
}

/** Put the parts of a `build()` geometry in place by `progress` (see makeBuildMaterial), in any material's vertex shader. */
function buildUp<M extends Material>(material: M, progress: { value: number }, key: string): M {
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
  material.customProgramCacheKey = () => key
  return material
}

/**
 * The material of something that is built up piece by piece: a flat-shaded,
 * vertex-coloured Lambert whose vertex shader puts each part of a geometry made
 * with `build()` (geomUtil.ts: its `aPart` says where the part stands and when
 * its turn comes, bottom parts first) in place as `progress.value` runs from 0
 * to 1. A part drops in from just above, growing from its base with a little
 * overshoot. It all happens on the GPU from that one number, so scrubbing it
 * with the scroll costs nothing per frame; at 1 the mesh is exactly its geometry.
 * `depth` does the same for the shadow pass: set it as the mesh's
 * `customDepthMaterial` and the shadow is built along with it (call
 * `requestShadowUpdate()` when `progress` changes).
 */
export function makeBuildMaterial(): { material: MeshLambertMaterial; depth: MeshDepthMaterial; progress: { value: number } } {
  const progress = { value: 0 }
  return {
    material: buildUp(new MeshLambertMaterial({ vertexColors: true, flatShading: true }), progress, 'build-up'),
    depth: buildUp(new MeshDepthMaterial(), progress, 'build-up-depth'),
    progress,
  }
}
