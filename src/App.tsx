import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, Stats } from '@react-three/drei'
import { NeutralToneMapping, PCFShadowMap } from 'three'
import { Scene } from './scene/Scene'
import { HOME_POSITION } from './scene/CameraRig'
import { setLowPower } from './scene/perf'
import { hideBoot } from './boot'
import { Toolbar } from './ui/Toolbar'
import { StoryHud } from './ui/story/StoryHud'
import { Dialogue } from './ui/story/Dialogue'
import { useQuestWatcher } from './story/useQuestWatcher'
import { useEndingDirector } from './story/useEndingDirector'
import { useTourDirector } from './story/useTourDirector'

// Retina screens get at most 1.5x; the monitor lowers this further on slow GPUs.
const MAX_DPR = Math.min(window.devicePixelRatio, 1.5)
const MIN_DPR = 0.75
const showStats = new URLSearchParams(window.location.search).has('stats')

export default function App() {
  const [dpr, setDpr] = useState(MAX_DPR)
  useQuestWatcher()
  useTourDirector()
  useEndingDirector()

  return (
    <>
      <Canvas
        frameloop="demand"
        shadows={{ type: PCFShadowMap }}
        dpr={dpr}
        camera={{ position: HOME_POSITION.toArray(), fov: 40, near: 0.1, far: 300 }}
        gl={{ antialias: true, toneMapping: NeutralToneMapping, powerPreference: 'high-performance' }}
        onContextMenu={(e) => e.preventDefault()}
        // Fade the loading screen once a couple of frames have been drawn.
        onCreated={() => requestAnimationFrame(() => requestAnimationFrame(hideBoot))}
      >
        <PerformanceMonitor
          bounds={() => [45, 58]}
          onChange={({ factor }) => {
            setDpr(Math.round((MIN_DPR + (MAX_DPR - MIN_DPR) * factor) * 20) / 20)
            setLowPower(factor < 0.35)
          }}
          onFallback={() => {
            setDpr(MIN_DPR)
            setLowPower(true)
          }}
        />
        <Scene />
        {showStats && <Stats />}
      </Canvas>
      <Dialogue placement="ship" />
      <Toolbar />
      <StoryHud />
    </>
  )
}
