import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { NeutralToneMapping, PCFShadowMap } from 'three'
import { Scene } from './scene/Scene'
import { HOME_POSITION } from './scene/CameraRig'
import { MAX_DPR } from './scene/PerfGovernor'
import { hideBoot } from './boot'
import { Toolbar } from './ui/Toolbar'
import { StoryHud } from './ui/story/StoryHud'
import { Dialogue } from './ui/story/Dialogue'
import { Hero } from './ui/story/Hero'
import { ScrollTrack } from './ui/story/ScrollTrack'
import { useCrewDirector } from './story/useCrewDirector'

const showStats = new URLSearchParams(window.location.search).has('stats')

export default function App() {
  useCrewDirector()

  return (
    <>
      <ScrollTrack />
      <div className="stage">
        <Canvas
          frameloop="demand"
          shadows={{ type: PCFShadowMap }}
          dpr={MAX_DPR}
          camera={{ position: HOME_POSITION.toArray(), fov: 40, near: 0.1, far: 300 }}
          gl={{ antialias: true, toneMapping: NeutralToneMapping, powerPreference: 'high-performance' }}
          onContextMenu={(e) => e.preventDefault()}
          // Fade the loading screen once a couple of frames have been drawn.
          onCreated={() => requestAnimationFrame(() => requestAnimationFrame(hideBoot))}
        >
          <Scene />
          {showStats && <Stats />}
        </Canvas>
      </div>
      <Hero />
      <Dialogue placement="ship" />
      <Toolbar />
      <StoryHud />
    </>
  )
}
