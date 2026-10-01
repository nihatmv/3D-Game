# CLAUDE.md

A cozy low-poly island builder that is also an interactive **portfolio**. The visitor is a ship and the island is the owner: a captain gives building tasks, each finished task raises a landmark that opens a project card, and the ending (ship docks, golden sunset) opens a contact card.

Stack: Vite + React 19 + TypeScript + React Three Fiber 9 + drei + zustand 5, three 0.186. **No model files**: every mesh is procedural (primitives merged with `build()` in `src/scene/geomUtil.ts` using vertex colors).

## Commands

```bash
npm run dev        # http://localhost:5173  (add ?stats for an FPS meter)
npm run typecheck  # tsc -p .
npm run build      # typecheck + production build; run before handing work back
```

There is no test suite. Verify changes with `npm run build` and, for visual work, a headless screenshot (see Testing below).

## Golden rules

1. **The portfolio must always be readable**, even by someone who never plays. The game is optional and the content isn't. The 📜 Portfolio button is always visible, "Skip, just show me everything" builds the whole island, and unbuilt projects still show their full content in the list.
2. **The owner's GPU is weak.** Keep rendering cheap:
   - The Canvas uses `frameloop="demand"`. `PerfGovernor` renders at about 30 fps when idle. Call `wake(ms)` from `src/scene/perf.ts` while something animates.
   - Shadows render on demand. Call `requestShadowUpdate()` when a shadow caster changes, and only while it changes.
   - Use Lambert materials, merged geometry or instancing, and avoid new lights or post-processing passes.
   - Optional eye candy checks `isLowPower()` (set by drei's PerformanceMonitor in `App.tsx`). DPR is capped at 1.5.
   - CSS animations should touch only `transform` and `opacity`.
   - Never add per-frame work that runs while idle.
3. **Content lives in data files only.** Changing projects or quests should not require game code changes.
4. **Work in phases and stop after each one** so the owner can test it. Don't commit unless asked.
5. **Keep this file current without being asked.** Before handing back any task that changed code, re-read CLAUDE.md and update it if the work made something here wrong or left out something a future session would need: a new file or module, a moved responsibility, a new gotcha, or a status change. Edit only when needed, keep edits short and in the existing style, and don't log routine fixes. In your final message, say in one line whether you updated CLAUDE.md and what changed.

## Layout

- `src/world/`: pure logic, with no React or three scene code. It holds grid helpers (`idx`, `inBounds`), terrain and shore fields, ponds, plant and tool rules (`canApply` returns false on locked tiles), and constants (`MAX_STONE`, `SEA_Y`, …).
- `src/store/useIslandStore.ts`: island state is typed arrays (heights, types, stones, plants, `locked`) plus the `terrainVersion` / `stoneVersion` / `plantVersion` counters. `claimTiles()` clears and locks landmark footprints. In dev it is exposed as `window.island`.
- `src/store/useStoryStore.ts`: the story state machine. It is exposed as `window.story` in dev.
  - `phase` moves through `intro → questing → ending → done`.
  - `shipState` moves through `arriving → waiting → docking → docked`.
  - It also holds `questIndex`, `built`, `placed`, `lastDone`, `openCard`, `portfolioOpen` and `sunset`.
- `src/story/`: the story's data and logic.
  - `projects.ts`: **portfolio content** (`PROJECTS`, `CONTACT`). It currently holds TODO placeholders that the owner will replace.
  - `quests.ts`: the ordered quests. Each has a dialogue line, a `tool`, an `area`, a `condition(snapshot, area)` and a `landmark` kind. The current quests are lighthouse base, lighthouse top, pond, pier and big tree.
  - `landmarks.ts`: `placeLandmark()` picks an anchor tile and claims its tiles. `findPier()` finds the pier. `PIER_DIR` (-1 = west) sets which way the pier reaches; the pier model, its sparkles, the dock flag and `dockPath` all follow it.
  - `useQuestWatcher.ts`: re-checks the active quest only when an island version counter changes.
  - `useEndingDirector.ts`: starts docking, then calls `finishStory()`.
  - `shipPath.ts`: the arrive and dock curves. The ship sails in from the top-left of the default view (-x, since the camera sits at +x +z) in `ARRIVE_SECONDS` (2s) and waits off the island's west shore, where the pier quest builds out. Moving the waiting spot to another side means changing `ARRIVE_PATH`, `PIER_DIR` and the pier quest's `area` together.
- `src/scene/`: R3F components (Island, Ocean, Ponds, Stones, Plants, Particles, Interaction, CameraRig, Lighting, HoverHighlight, PerfGovernor).
  - `CameraRig` uses `setViewOffset` (`VIEW_SHIFT`) so the island sits above the dialogue and toolbar.
  - `Lighting` owns the sky, fog and lights, and eases the sunset (`sunset.ts`).
- `src/scene/story/`: Ship, Landmarks (pop animation, click to open the card, lighthouse beam, pond ripples, dock flag), QuestGhost (the ring over the task area), and the landmark and ship geometry.
  - `shipGeometry.ts` is a pirate ship (dark sails, Jolly Roger, cannons) merged into one mesh. Its sails are swung off square (`BRACE`) so they face the camera rather than showing their edge.
- `src/ui/`: the Toolbar (it pulses the quest tool). `src/ui/story/` holds StoryHud, Dialogue, ProjectCard, PortfolioPanel, ProjectBody, PirateAvatar and `Story.css`.
  - `Dialogue` is mounted twice: `placement="ship"` in `App` and `placement="toolbar"` in the Toolbar. Each renders only on its own screens (`BESIDE_SHIP` media query: at least 900px wide and over 500px tall). The two copies keep separate intro state.
  - On wide screens the bubble floats beside the ship. `Ship.tsx` projects the ship to screen coordinates every frame and calls `setShipScreen()` in `shipBubble.ts`. That module places the bubble left of the ship, narrowed to fit, or below the ship near the left edge, and restyles it only when its rounded position changes.
  - `PirateAvatar` is the captain's portrait, drawn in inline SVG.

## Gotchas

- In `completeQuest` and `skipAll`, set story state **before** placing the landmark. Placing a landmark edits the island, which re-runs the quest watcher.
- `skipAll` places landmarks in quest order, because the lighthouse top needs its base.
- Keep frame-time clamps loose (`Math.min(dt, 0.25)`). A tight clamp makes animations take far longer on slow machines.
- Landmarks call `stopPropagation` on pointer events so clicking them doesn't fire a tool.
- The ship docks on the far side of the pier (`ALONGSIDE` negative) so it doesn't hide the pier from the camera.

## Testing **headless**

Use playwright-core with the cached chromium headless shell. The playwright-core in `~/.npm/_npx` may expect a newer browser build than the one cached, so pass `executablePath` pointing at `~/Library/Caches/ms-playwright/chromium_headless_shell-*/…/chrome-headless-shell`. Launch it with the `--use-angle=swiftshader --enable-unsafe-swiftshader` flags and run the dev server with `npx vite --port 5179 --strictPort`.

Drive states through `window.story.getState()` and `window.island.getState()`, for example `window.story.getState().skipAll()`.

Software rendering gives roughly 10 fps. Compare performance before and after a change, not as absolute numbers.

## Status

- All 5 phases are done: portfolio data and UI, ship and quests, landmarks, the docking and sunset ending, and mobile.
- Touch input works as follows:
  - `Interaction.tsx` builds on finger *lift* if the finger moved less than 12px, and never paints on drag.
  - A second finger cancels the tap and becomes a camera gesture (`touches: ONE none, TWO DOLLY_ROTATE` in `CameraRig`).
  - The toolbar's **Remove** toggle (`erase` in the island store, read via `isRemoveMode()` in `modifiers.ts`) stands in for Shift. It is shown only on touch screens (`useTouchScreen`).
- Layout:
  - Portrait screens step the camera back (`fitDistance`).
  - Short landscape screens (`max-height: 500px`) put the captain bottom-left and the tools bottom-right.
  - Wide screens show the captain's bubble beside the ship rather than above the toolbar.
- The plan is in `~/.claude/plans/lets-do-something-like-federated-hollerith.md`.
- **Next:** the owner will supply real project and contact content for `src/story/projects.ts`.
