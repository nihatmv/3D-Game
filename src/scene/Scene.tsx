import { PALETTE } from '../world/constants'
import { CameraRig } from './CameraRig'
import { HoverHighlight } from './HoverHighlight'
import { Interaction } from './Interaction'
import { Island } from './Island'
import { Ocean } from './Ocean'
import { Particles } from './Particles'
import { PerfGovernor } from './PerfGovernor'
import { Plants } from './Plants'
import { Ponds } from './Ponds'
import { Stones } from './Stones'

export function Scene() {
  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <fog attach="fog" args={[PALETTE.sky, 45, 120]} />

      <hemisphereLight args={[PALETTE.sun, PALETTE.ground, 1.35]} />
      <directionalLight
        position={[14, 24, 9]}
        intensity={2.1}
        color={PALETTE.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />

      <PerfGovernor />
      <CameraRig />

      <Interaction>
        <Island />
        <Ocean />
        <Stones />
        <Ponds />
      </Interaction>
      <Plants />
      <Particles />
      <HoverHighlight />
    </>
  )
}
