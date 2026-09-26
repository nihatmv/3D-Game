# 3D-Game — Cozy Island

A cozy low-poly island-building toy that runs in the browser. Shape a small
floating island in a calm turquoise ocean: raise land, dig ponds, stack stones
and plant seeds that grow into grass, bushes, trees and reeds.

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
| 4   | Seeds | Scatter seeds that grow over about 10 s    | Clear plants on a tile  |

Right-drag to orbit, middle-drag to pan, and scroll to zoom.

What grows depends on where the seed lands: reeds and cattails next to water,
trees on soil, grass tufts, bushes and flowers on grass, and nothing on stone.

## Project layout

- `src/world/`: pure logic, including grid helpers, terrain mesh generation,
  pond water levels, plant and tool rules, and constants.
- `src/store/`: zustand store holding tile heights, types, stones and plants.
- `src/scene/`: React Three Fiber components (Island, Ocean, Ponds, Stones,
  Plants, Particles, interaction, camera, performance governor).
- `src/ui/`: toolbar overlay.

## Performance

The app is tuned for modest GPUs:

- It renders on demand, at full rate while you interact and about 30 fps when
  idle.
- Shadows redraw only when the scene changes.
- Resolution is capped and adapts to the frame rate.
- Stones, plants and particles are instanced, so each kind costs one draw call.
