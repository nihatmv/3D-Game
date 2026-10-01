# 3D-Game — Cozy Island

A cozy low-poly island-building toy that runs in the browser, and an
interactive portfolio. Shape a small floating island in a calm turquoise ocean:
raise land, dig ponds, stack stones and plant seeds that grow into grass,
bushes, trees and reeds.

**You are the island, the visitor is the ship.** A ship sails in and its
captain asks for help. Every finished task raises a landmark (lighthouse, pond,
pier, big tree) and opens one of my project cards. When everything is built,
the ship docks at the pier, the sun sets to golden hour and a contact card
opens.

The game is optional, the portfolio isn't. The **📜 Portfolio** button
always lists every project, and **Skip, just show me everything** builds the
whole island at once.

Built with Vite, React, TypeScript, React Three Fiber, drei and zustand. There
are no model files: everything is generated from primitives or procedural
geometry.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

Add `?stats` to the URL to show an FPS meter.

## Controls

| Key | Tool  | Click / drag                               | Shift + click           |
| --- | ----- | ------------------------------------------ | ----------------------- |
| 1   | Soil  | Raise land (clicking the ocean makes new land) | Lower land          |
| 2   | Stone | Place a boulder, click again to stack (max 4) | Remove the top piece |
| 3   | Water | Dig a pond                                 | Fill the pond back in   |
| 4   | Seeds | Scatter seeds that grow over about 4 s     | Clear plants on a tile  |

Right-drag to orbit, middle-drag to pan, and scroll to zoom. Built landmarks
are clickable and reopen their project card. Esc closes cards.

### On a phone or tablet

- Tap a tile to use the current tool. Dragging one finger doesn't paint, so
  you won't build by accident.
- Two fingers turn and zoom the camera.
- The **Remove** button in the toolbar replaces Shift: while it's on, taps undo
  instead of build.

What grows depends on where the seed lands: reeds and cattails next to water,
trees on soil, grass tufts, bushes and flowers on grass, and nothing on stone.

## Project layout

- `src/world/`: pure logic, including grid helpers, terrain mesh generation,
  pond water levels, plant and tool rules, and constants.
- `src/store/`: zustand store holding tile heights, types, stones and plants.
- `src/scene/`: React Three Fiber components (Island, Ocean, Ponds, Stones,
  Plants, Particles, interaction, camera, performance governor).
- `src/ui/`: toolbar overlay.
- `src/story/`: story mode. `projects.ts` holds the portfolio content and
  `quests.ts` the tasks (dialogue, tool, area and completion check).
  `landmarks.ts` places each landmark.
- `src/store/useStoryStore.ts`: story progress (phase, built landmarks, open
  card, ship state, sunset).
- `src/scene/story/` and `src/ui/story/`: ship, landmarks, quest ring, captain
  dialogue, project cards and portfolio list.

## Editing the portfolio

All content is data:

- **Projects and contact details:** `src/story/projects.ts`. Each project has
  a title, pitch, details, stack, links and an optional image.
- **Tasks:** `src/story/quests.ts`. Each quest names the project it unlocks
  (`projectId`), the captain's lines, the tool, the area on the island and the
  condition that completes it.

You don't need to touch any game code.

## Performance

The app is tuned for modest GPUs:

- It renders on demand, at full rate while you interact and about 30 fps when
  idle.
- Shadows redraw only when the scene changes.
- Resolution is capped and adapts to the frame rate.
- Stones, plants and particles are instanced, so each kind costs one draw call.
- Story mode adds little: the ship and each landmark are one merged mesh, the
  sunset only changes existing colors, and the lighthouse beams turn off on slow
  machines. Idle frame rate measured the same with and without story mode.
