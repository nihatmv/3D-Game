# CLAUDE.md

A cozy low-poly island builder that doubles as an interactive **portfolio**, sent as a cold-outreach link. The visitor is a ship, the island is the owner. The visitor scrolls: the ship sails in to a bare island, the crew walks to each site and raises a landmark, a compact project card comes up beside it, and the ending (golden sunset) opens a contact card. Goal: visitor knows who the owner is in 5 seconds and finishes the tour in 60–90 seconds. If a change makes the tour longer, suggest what to cut instead.

Stack: Vite + React 19 + TypeScript + React Three Fiber 9 + drei + zustand 5, three 0.186. **No model files**: every mesh is procedural (primitives merged with `build()` in `src/scene/geomUtil.ts`, vertex colors).

## Commands

```bash
npm run dev        # http://localhost:5173  (?stats for an FPS meter)
npm run typecheck
npm run build      # run before handing work back
```

No test suite. Verify with `npm run build` and, for visual work, a headless screenshot.

## Golden rules

1. **The portfolio must always be readable**, even without playing. There is no separate page: the island is the portfolio, on phones too. "Skip" (`skipAll`) builds the whole island at once, so every landmark opens its card.
2. **The owner's GPU is weak.** `frameloop="demand"`: call `wake(ms)` (`src/scene/perf.ts`) while animating and `requestShadowUpdate()` only while a shadow caster changes. Lambert materials, merged geometry or instancing, no new lights or post-processing. Optional eye candy checks `isLowPower()`. CSS animates only `transform`/`opacity`. No per-frame work while idle.
3. **Content lives in data files only** (`src/story/projects.ts`, `quests.ts`).
4. **Work in phases and stop after each one.** Don't commit unless asked.
5. **Keep this file current, but only when it matters.** See "Updating this file" below.

## Layout

- `src/main.tsx` renders `App` (the 3D island), the only view.
- `src/visitor.ts`: `?for=acme` personalization (`VISITOR`). `src/analytics.ts`: `track()`, provider chosen by env (see `.env.example`).
- `index.html` + `vite.config.ts`: plain-HTML loading screen (`hideBoot()` in `src/boot.ts`) and OG tags filled from `CONTACT`. `public/og.png` is a headless capture (1200×630, `skipAll()`, UI hidden, a name card added by the capture script); re-capture when the island's look or `CONTACT` changes.
- `src/world/`: pure grid/terrain/tool logic, no React. `decor.ts` holds hand-placed scenery (`HIGHLAND`, `DECOR_FALLS`, `DECOR_CABIN`, `DECOR_PATH`); its tiles are locked, and decor must stay clear of quest areas and the pier row.
- `src/store/`: `useIslandStore` (typed arrays + version counters, `window.island` in dev) and `useStoryStore` (the story state machine, `window.story` in dev): `phase` intro → questing (the scroll tour, `isTourActive`) → done (free play, entered with `explore()` from the contact card), `beat` = the stretch of the scroll story that is on, `shipState` arriving → docked, `openCard` = the full card, `focus` = landmark the camera flies to (free play only).
- `src/story/`: content and story logic.
  - `projects.ts` is the portfolio content (real: the lighthouse is the Reddit Scraper, the pond is ShipLog, the forest is SABAH.HUB (its `shipped` list links the live products), the cabin is the Remote Job Globe, the falls is this island itself (`cozy-island`); some `result` lines still want better numbers). A project's `demo` ties to a landmark: `song` → pond (no project uses it now, so the pond's listen/bubble code is dormant), `milestone` → tree.
  - `quests.ts`: ordered quests; `TOUR` is the non-`auto` ones: lighthouse, pond, forest (`tree`), cabin (`home`), falls. The pier is `auto`: placed when the story store loads, before the ship lands. `questIndex` = the next stop to build.
  - The island starts bare. Scenery stops (`cabin`, `falls`) have no `clicks`: `Scene` mounts `Cabin`/`StonePath`/`Waterfall` once built (`useBuilt`), and their landmark is an invisible click box (`isScenery`). The decor trees grow with the forest stop (`growForest`).
  - `scrollDirector.ts` (stepped by `scene/story/ScrollDriver`) turns scroll progress into the story: it sets `beat`, plays each quest's `clicks` and places its landmark as the scroll passes its build stretch (built once, kept when scrolling back; a stop jumped over is placed directly), and starts the crew's cheer as the sunset begins. `riseOf`/`riseOfKind` give each landmark's rise from the scroll, so buildings sink and rise with it. The end is scroll too: `gather` (camera and crew to the cabin), `sunset` (`Lighting` bends the hour toward golden), `contact` (the contact card with "Explore the island"). `progress.ts` saves the built stops to localStorage; a returning visitor's page opens at the last built stop's card (at the contact card after a finished tour), still scrollable.
  - `crew.ts`: the captain + 5 men as plain mutable state, drawn by `scene/story/Crew.tsx` (three instanced meshes + the captain's hat, no shadows). During the tour `scrubCrew(scroll.value)` puts them where the story is: down the pier, to each site, hammering through its build, into a row at the cabin. Stands and walks are laid when first reached and cached, and keep off the tiles the pond will be dug into. The cheer at the sunset is the one timed bit (`crewParty`/`stepParty`). In free play `useCrewDirector` starts them from the row (`gatherCrew`) and `crewWander` lets them stroll: dry ground only, around landmarks, trees and stones, at the idle frame rate (`stepCrew`, no `wake`).
  - `scroll.ts` + `timeline.ts`: the page scrolls past the fixed island (`ui/story/ScrollTrack`, on during the tour only); `scroll.value` (0..1, eased by `scene/story/ScrollDriver`) is story progress and `timeline.ts` says which stretch plays what (`segmentOf`, `progressIn`). The ship, the camera (`CameraRig`: home view, then a close-up per stop) and every landmark's rise read it.
  - `landmarks.ts` places landmarks and the pier (`PIER_DIR`). `shipPath.ts` has the landing curve (`landingPath`); moving the pier means changing `ARRIVE_PATH`, `PIER_DIR` and the pier quest's `area` together.
- `src/scene/`: R3F components. `CameraRig` owns the home view, `setViewOffset` and the fly-to-focus; `Lighting` eases the time of day toward the story's `hour` (the visitor's local clock; free play's HUD timeline can drag it), bent toward golden hour by the scroll at the end of the tour. `timeOfDay.ts` holds the keyframes, sun/moon arcs and the `tod` state that water, cabin and fireflies read; `Sky` draws the dome, sun, moon and stars. Scenery: `Cabin`, `Waterfall`, `StonePath` (not clickable).
- `src/scene/story/`: Ship, Crew, Landmarks (pop-in, demos, click to open card), QuestGhost (the "Click here" target).
- `src/ui/`: Toolbar (hidden during the tour). `src/ui/story/`: StoryHud, TimeOfDay (the timeline), Dialogue (mounted twice: beside the ship on wide screens, above the toolbar otherwise), StopCard (the compact card of a tour stop; Details opens ProjectCard), ProjectCard, ProjectBody, ProjectDemo, Hero, ScrollTrack.

## Gotchas

- In `completeQuest` / `skipAll`, set story state **before** placing the landmark (placing edits the island, and subscribers must see the stop as built).
- Anything read from `scroll.value` in `useFrame` should return early when the value hasn't changed, so a resting page costs nothing.
- Headless: scroll with `window.scrollTo` in small steps (wheel events overshoot). `skipAll()` builds everything and enters free play; the page does not scroll there.
- Keep frame-time clamps loose (`Math.min(dt, 0.25)`).
- `PerfGovernor` measures the frame rate itself (dpr + `setLowPower`) and counts awake frames only. Don't use drei's `PerformanceMonitor`: it reads the idle 30fps as a slow GPU and hides the eye candy.
- The camera can't look above ~13° over the horizon, so the sun at dawn/sunset and the moon must stay low and in front of the home view (`RISE_AZ`/`SET_AZ` in `timeOfDay.ts`).
- Landmarks `stopPropagation` on pointer events so clicks don't fire a tool.
- Don't add Rolldown manual/vendor chunks: a `three` chunk crashed production. Check `npx vite preview` after any build config change.
- Water tiles at different levels must not share an edge (`computePondLevels` merges them). The falls' spring is a mesh for this reason.
- The pond's lake geometry is laid out for its exact `clicks` shape; changing the shape means re-placing bridge, pads and reeds.

## Testing headless

playwright-core with the cached chromium headless shell (pass `executablePath` under `~/Library/Caches/ms-playwright/chromium_headless_shell-*`), flags `--use-angle=swiftshader --enable-unsafe-swiftshader`, dev server `npx vite --port 5179 --strictPort`. Drive state via `window.story.getState()` / `window.island.getState()` (e.g. `skipAll()`); project world points with `window.camera`. Software rendering is ~10 fps, so compare performance before/after, not absolute.

## Status

Both 5-phase plans are done (base game, then the outreach pass: hero, fly-to cards, demos, `?for=`, OG tags, analytics; its `/portfolio` page was later removed). Plans: `~/.claude/plans/lets-do-something-like-federated-hollerith.md` and `~/.claude/plans/pasted-content-id-7ae0-i-want-mossy-rivest.md`. All five cards in `projects.ts` now have the owner's real content.

In progress: the crew pass (captain + 5 men land and build the island). Phases 1–4 done (ship lands first, bare island, five stops; crew steps off, runs to each site and hammers; ending at the cabin). Its timing pass is superseded by the scroll pass.

The scroll pass is done too (5 phases: the tour is driven by page scroll instead of clicks; plan: `~/.claude/plans/hey-i-wanna-turn-merry-simon.md`). All timing is the segment lengths at the top of `story/timeline.ts`. Not yet tried on a real phone (address-bar resize, touch scrolling over cards).

## Updating this file

A Stop hook (`.claude/hooks/claude-md-reminder.sh`) reminds you once after code changes. When it fires, decide:

- **Update** if the work added a file/module, moved a responsibility, introduced a gotcha, broke something written here, or changed the status.
- **Skip** for routine fixes, tweaks, styling or anything a future session can find by reading the code. Skipping is fine and expected most of the time.

Keep edits to a line or two in the existing style. In your final message, say in one line whether you updated CLAUDE.md.
