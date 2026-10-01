import { CameraRig } from './CameraRig'
import { HoverHighlight } from './HoverHighlight'
import { Interaction } from './Interaction'
import { Lighting } from './Lighting'
import { Island } from './Island'
import { Ocean } from './Ocean'
import { Particles } from './Particles'
import { PerfGovernor } from './PerfGovernor'
import { Plants } from './Plants'
import { Ponds } from './Ponds'
import { Stones } from './Stones'
import { Landmarks } from './story/Landmarks'
import { QuestGhost } from './story/QuestGhost'
import { Ship } from './story/Ship'

export function Scene() {
  return (
    <>
      <Lighting />

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
      <Landmarks />
      <Ship />
      <QuestGhost />
    </>
  )
}
