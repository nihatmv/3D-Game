import { Cabin } from './Cabin'
import { CameraRig } from './CameraRig'
import { HoverHighlight } from './HoverHighlight'
import { Interaction } from './Interaction'
import { Lighting } from './Lighting'
import { Island } from './Island'
import { Ocean } from './Ocean'
import { Particles } from './Particles'
import { PerfGovernor } from './PerfGovernor'
import { Plants } from './Plants'
import { Sky } from './Sky'
import { Ponds } from './Ponds'
import { StonePath } from './StonePath'
import { Stones } from './Stones'
import { Waterfall } from './Waterfall'
import { Crew } from './story/Crew'
import { Landmarks } from './story/Landmarks'
import { QuestGhost } from './story/QuestGhost'
import { Ship } from './story/Ship'
import { useBuilt } from '../store/useStoryStore'

export function Scene() {
  // The island starts bare: the cabin (with its path) and the falls wait for their tour stops.
  const home = useBuilt('cabin')
  const falls = useBuilt('falls')
  return (
    <>
      <Lighting />
      <Sky />

      <PerfGovernor />
      <CameraRig />

      <Interaction>
        <Island />
        <Ocean />
        <Stones />
        <Ponds />
      </Interaction>
      {falls && <Waterfall />}
      {home && <Cabin />}
      {home && <StonePath />}
      <Plants />
      <Particles />
      <HoverHighlight />
      <Landmarks />
      <Ship />
      <Crew />
      <QuestGhost />
    </>
  )
}
