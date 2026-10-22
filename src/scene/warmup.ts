import { BoxGeometry, BufferGeometry, Color, InstancedMesh, Mesh, type Material } from 'three'

/** Position, normal and uv, like three's own shapes. */
const box = new BoxGeometry(1, 1, 1)

/**
 * A stand-in for ShaderWarmup: a mesh drawn with `material` under the loading
 * screen, so its shader program is compiled before the tour first shows the
 * real one. Whatever else goes into the program must match the real mesh: the
 * geometry's attributes (pass the real `geometry` unless it has a normal and
 * uv, like three's shapes), instancing (`instanced`, `colored` for
 * per-instance colours) and a shadow cast with a custom depth material (`depth`).
 */
export function warmMesh(
  material: Material,
  o: { geometry?: BufferGeometry; instanced?: boolean; colored?: boolean; depth?: Material } = {},
): Mesh {
  const geometry = o.geometry ?? box
  let mesh: Mesh
  if (o.instanced) {
    const many = new InstancedMesh(geometry, material, 1)
    if (o.colored) many.setColorAt(0, new Color())
    mesh = many
  } else mesh = new Mesh(geometry, material)
  if (o.depth) {
    mesh.customDepthMaterial = o.depth
    mesh.castShadow = true
  }
  return mesh
}
