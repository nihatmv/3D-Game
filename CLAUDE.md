# CLAUDE.md

A cozy low-poly island builder that doubles as an interactive **portfolio**, sent as a cold-outreach link. The visitor is a ship, the island is the owner. A captain gives building tasks, each finished task raises a landmark that opens a project card, and the ending (ship docks, golden sunset) opens a contact card. Goal: visitor knows who the owner is in 5 seconds and finishes the tour in 60–90 seconds. If a change makes the tour longer, suggest what to cut instead.

Stack: Vite + React 19 + TypeScript + React Three Fiber 9 + drei + zustand 5, three 0.186. **No model files**: every mesh is procedural (primitives merged with `build()` in `src/scene/geomUtil.ts`, vertex colors).

## Commands

```bash
npm run dev        # http://localhost:5173  (?stats for an FPS meter)
npm run typecheck
npm run build      # run before handing work back
```

No test suite. Verify with `npm run build` and, for visual work, a headless screenshot.

## Golden rules

1. **The portfolio must always be readable**, even without playing. The 📜 Portfolio link is always visible; it and "Skip" open the plain `/portfolio` page (no 3D). Phones see that page first.
2. **The owner's GPU is weak.** `frameloop="demand"`: call `wake(ms)` (`src/scene/perf.ts`) while animating and `requestShadowUpdate()` only while a shadow caster changes. Lambert materials, merged geometry or instancing, no new lights or post-processing. Optional eye candy checks `isLowPower()`. CSS animates only `transform`/`opacity`. No per-frame work while idle.
3. **Content lives in data files only** (`src/story/projects.ts`, `quests.ts`).
4. **Work in phases and stop after each one.** Don't commit unless asked.
5. **Keep this file current, but only when it matters.** See "Updating this file" below.

## Layout

- `src/main.tsx` + `routes.ts`: `/portfolio` (and phones, unless `?tour`) render `PortfolioPage`; otherwise `App` (the 3D island) is lazy-loaded. `src/page/` must never import anything that pulls in three.
- `src/visitor.ts`: `?for=acme` personalization (`VISITOR`, `withVisitor`). `src/analytics.ts`: `track()`, provider chosen by env (see `.env.example`).
- `index.html` + `vite.config.ts`: plain-HTML loading screen (`hideBoot()` in `src/boot.ts`) and OG tags filled from `CONTACT`. `public/og.png` is a headless capture; re-capture when the island's look changes.
- `src/world/`: pure grid/terrain/tool logic, no React. `decor.ts` holds hand-placed scenery (`HIGHLAND`, `DECOR_FALLS`, `DECOR_CABIN`, `DECOR_PATH`); its tiles are locked, and decor must stay clear of quest areas and the pier row.
- `src/store/`: `useIslandStore` (typed arrays + version counters, `window.island` in dev) and `useStoryStore` (the story state machine, `window.story` in dev): `phase` intro → questing → ending → done, `shipState` arriving → waiting → docking → docked, `focus` = landmark the camera flies to while its card is open.
- `src/story/`: content and story logic.
  - `projects.ts` is the portfolio content (still TODO placeholders). A project's `demo` ties to a landmark: `commit` → lighthouse, `song` → pond, `milestone` → tree.
  - `quests.ts`: ordered quests; `TOUR` is the non-`auto` ones (the pier is built automatically in the ending). `questIndex` indexes `TOUR`.
  - `questBuild.ts` plays a quest's `clicks`; `useTourDirector` auto-advances and runs "⚡ Build it all"; `useEndingDirector` docks the ship; `progress.ts` saves tour progress to localStorage.
  - `landmarks.ts` places landmarks and the pier (`PIER_DIR`). `shipPath.ts` has the arrive/dock curves; moving the ship's waiting spot means changing `ARRIVE_PATH`, `PIER_DIR` and the pier quest's `area` together.
- `src/scene/`: R3F components. `CameraRig` owns the home view, `setViewOffset` and the fly-to-focus; `Lighting` eases the time of day toward the story's `hour` (follows the visitor's local clock until the HUD timeline is dragged; the ending eases to golden hour). `timeOfDay.ts` holds the keyframes, sun/moon arcs and the `tod` state that water, cabin and fireflies read; `Sky` draws the dome, sun, moon and stars. Scenery: `Cabin`, `Waterfall`, `StonePath` (not clickable).
- `src/scene/story/`: Ship, Landmarks (pop-in, demos, click to open card), QuestGhost (the "Click here" target).
- `src/ui/`: Toolbar (hidden during the tour). `src/ui/story/`: StoryHud, TimeOfDay (the timeline), Hero, Dialogue (mounted twice: beside the ship on wide screens, above the toolbar otherwise), ProjectCard, ProjectBody, ProjectDemo.

## Gotchas

- In `completeQuest` / `skipAll`, set story state **before** placing the landmark (placing edits the island and re-runs the quest watcher).
- Story actions called from store subscribers must guard against re-entry (`startDocking` checks `shipState === 'waiting'`).
- Keep frame-time clamps loose (`Math.min(dt, 0.25)`).
- The camera can't look above ~13° over the horizon, so the sun at dawn/sunset and the moon must stay low and in front of the home view (`RISE_AZ`/`SET_AZ` in `timeOfDay.ts`).
- Landmarks `stopPropagation` on pointer events so clicks don't fire a tool.
- Don't add Rolldown manual/vendor chunks: a `three` chunk crashed production. Check `npx vite preview` after any build config change.
- Water tiles at different levels must not share an edge (`computePondLevels` merges them). The falls' spring is a mesh for this reason.
- The pond's lake geometry is laid out for its exact `clicks` shape; changing the shape means re-placing bridge, pads and reeds.

## Testing headless

playwright-core with the cached chromium headless shell (pass `executablePath` under `~/Library/Caches/ms-playwright/chromium_headless_shell-*`), flags `--use-angle=swiftshader --enable-unsafe-swiftshader`, dev server `npx vite --port 5179 --strictPort`. Drive state via `window.story.getState()` / `window.island.getState()` (e.g. `skipAll()`); project world points with `window.camera`. Add `?tour` for phone-sized viewports. Software rendering is ~10 fps, so compare performance before/after, not absolute.

## Status

Both 5-phase plans are done (base game, then the outreach pass: hero, fly-to cards, demos, `/portfolio` page, `?for=`, OG tags, analytics). Plans: `~/.claude/plans/lets-do-something-like-federated-hollerith.md` and `~/.claude/plans/pasted-content-id-7ae0-i-want-mossy-rivest.md`. Waiting on the owner's real content for `projects.ts`.

## Updating this file

A Stop hook (`.claude/hooks/claude-md-reminder.sh`) reminds you once after code changes. When it fires, decide:

- **Update** if the work added a file/module, moved a responsibility, introduced a gotcha, broke something written here, or changed the status.
- **Skip** for routine fixes, tweaks, styling or anything a future session can find by reading the code. Skipping is fine and expected most of the time.

Keep edits to a line or two in the existing style. In your final message, say in one line whether you updated CLAUDE.md.
