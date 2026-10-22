import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { cabinWarmups } from './Cabin'
import { requestShadowUpdate, wake } from './perf'
import { landmarkWarmups } from './story/Landmarks'
import { ghostWarmups } from './story/QuestGhost'
import { waterfallWarmups } from './Waterfall'

/**
 * The stand-ins are drawn on frames 1 and 2, each with the shadow map redrawn
 * (asked for a frame ahead). Not on frame 0: three draws shadows before it
 * sets up a frame's lights, so there a depth shader would be made for no
 * lights, and a depth material keeps the shader it was first given.
 */
const FIRST = 1
const LAST = 2

/**
 * Compiles, under the loading screen, the shaders of what the tour brings in
 * later (the "Click here" marker, a build's shadow, the lighthouse's lamp and
 * beam, ripples, the grove's critters, the cabin, the falls), so none of them
 * stalls a step the first time it is drawn: on a slow GPU each compile is a
 * visible hitch. Their stand-ins (warmup.ts) are drawn for a couple of frames,
 * tiny and far under the island, then hidden but kept: three keeps a program
 * for as long as a material using it lives.
 */
export function ShaderWarmup() {
  const group = useMemo(() => {
    const g = new Group()
    g.visible = false
    g.position.y = -40
    g.scale.setScalar(0.001)
    for (const mesh of [...ghostWarmups(), ...landmarkWarmups(), ...cabinWarmups(), ...waterfallWarmups()]) {
      mesh.frustumCulled = false
      g.add(mesh)
    }
    return g
  }, [])
  useEffect(() => wake(500), [])
  const frames = useRef(0)
  useFrame(() => {
    const frame = frames.current
    if (frame > LAST + 1) return
    frames.current++
    group.visible = frame >= FIRST && frame <= LAST
    // Picked up on the next frame.
    if (frame < LAST) requestShadowUpdate()
  })
  return <primitive object={group} dispose={null} />
}
