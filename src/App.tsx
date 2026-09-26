import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, Stats } from '@react-three/drei'
import { NeutralToneMapping, PCFShadowMap } from 'three'
import { Scene } from './scene/Scene'
import { Toolbar } from './ui/Toolbar'

// Retina screens get at most 1.5x; the monitor lowers this further on slow GPUs.
const MAX_DPR = Math.min(window.devicePixelRatio, 1.5)
const MIN_DPR = 0.75
const showStats = new URLSearchParams(window.location.search).has('stats')

export default function App() {
  const [dpr, setDpr] = useState(MAX_DPR)

  return (
    <>
      <Canvas
        frameloop="demand"
        shadows={{ type: PCFShadowMap }}
        dpr={dpr}
        camera={{ position: [20, 17, 20], fov: 40, near: 0.1, far: 300 }}
        gl={{ antialias: true, toneMapping: NeutralToneMapping, powerPreference: 'high-performance' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <PerformanceMonitor
          bounds={() => [45, 58]}
          onChange={({ factor }) => setDpr(Math.round((MIN_DPR + (MAX_DPR - MIN_DPR) * factor) * 20) / 20)}
          onFallback={() => setDpr(MIN_DPR)}
        />
        <Scene />
        {showStats && <Stats />}
      </Canvas>
      <Toolbar />
    </>
  )
}
