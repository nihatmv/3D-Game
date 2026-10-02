# CLAUDE.md

A cozy low-poly island builder that is also an interactive **portfolio**, sent as a cold-outreach link. The visitor is a ship and the island is the owner: a captain gives building tasks, each finished task raises a landmark that opens a project card, and the ending (ship docks, golden sunset) opens a contact card. The target is for a visitor to know who the owner is in 5 seconds and finish the tour in 60–90 seconds. If a change makes the tour longer, suggest what to cut instead.

Stack: Vite + React 19 + TypeScript + React Three Fiber 9 + drei + zustand 5, three 0.186. **No model files**: every mesh is procedural (primitives merged with `build()` in `src/scene/geomUtil.ts` using vertex colors).

## Commands

```bash
npm run dev        # http://localhost:5173  (add ?stats for an FPS meter)
npm run typecheck  # tsc -p .
npm run build      # typecheck + production build; run before handing work back
```

There is no test suite. Verify changes with `npm run build` and, for visual work, a headless screenshot (see Testing below).

## Golden rules

1. **The portfolio must always be readable**, even by someone who never plays. The game is optional and the content isn't. The 📜 Portfolio link is always visible. It and "Skip, just show me everything" open the plain `/portfolio` page, which has every project, experience, education and contact, and no 3D. Phones see that page first.
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

- `src/main.tsx` + `src/routes.ts`: `showPortfolioPage()` renders `PortfolioPage` on `/portfolio`, and on phones unless `?tour` is set. Otherwise it lazy-loads `App` (the 3D island), so the page never downloads three.js. Moving between the two views is a full page load (plain links). `vercel.json` and `public/_redirects` rewrite `/portfolio` to `index.html`.
- `src/visitor.ts`: `?for=acme` handling. `VISITOR` is the cleaned-up name (letters, digits, spaces and `& . ' -` only, at most 24 characters, rendered only as text). It drives the captain's "Ahoy, Acme crew!" and the page greeting. `withVisitor(href)` keeps `?for=` on links between the two views.
- `src/analytics.ts`: `track(event, props)`, plus `trackThenGo` for same-tab links. The provider is chosen by env only (`VITE_ANALYTICS_PROVIDER=plausible` + `VITE_PLAUSIBLE_DOMAIN`, see `.env.example`); with none set, events are dropped and logged in dev. The events are `tour_started`, `landmark_completed`, `skip_clicked`, `build_all_clicked` and `contact_clicked`, and each carries `for` when the link is personalized.
- `index.html` + `vite.config.ts`: the loading screen (`#boot`) is plain HTML. `src/boot.ts` `hideBoot()` removes it, called by the page on mount and by the island after its first frames. The `portfolioHtml` plugin fills `%APP_*%` (name, title, description, and the OG/Twitter tags) from `CONTACT` in `projects.ts`. `VITE_SITE_URL` makes `og:image` absolute. `public/og.png` is a 1200×630 placeholder captured headless at sunset.
- `src/page/`: `PortfolioPage` and its CSS. It reuses the card pieces in `ProjectBody` (media, result, chips, links, `ContactLinks`, `Portrait`) and the `ProjectDemo` blocks. It must not import anything that pulls in three, such as the story or island stores.

- `src/world/`: pure logic, with no React or three scene code. It holds grid helpers (`idx`, `inBounds`), terrain and shore fields, ponds, plant and tool rules (`canApply` returns false on locked tiles, and soil can raise a sea tile only if it shares an edge with land: `touchesLand`), and constants (`MAX_STONE`, `SEA_Y`, …).
  - `decor.ts` holds the hand-placed plants and boulders on the starting island. Keep them clear of every quest `area` and of the pier row.
- `src/store/useIslandStore.ts`: island state is typed arrays (heights, types, stones, plants, `locked`) plus the `terrainVersion` / `stoneVersion` / `plantVersion` counters. `claimTiles()` clears and locks landmark footprints. In dev it is exposed as `window.island`.
- `src/store/useStoryStore.ts`: the story state machine. It is exposed as `window.story` in dev.
  - `phase` moves through `intro → questing → ending → done`. `isTourActive()` is true during intro and questing: the camera is locked, the toolbar is hidden, and `Interaction` builds only via the quest target.
  - `questIndex` indexes `TOUR` (the non-`auto` quests), not `QUESTS`.
  - `shipState` moves through `arriving → waiting → docking → docked`.
  - It also holds `questIndex`, `built`, `placed`, `lastDone`, `openCard`, `focus` and `sunset`.
  - `focus` is the landmark the camera flies to while its card is open. `openProject(id, at)` sets it, and `closeCard()` clears it and flies home. In the tour, `closeCard` is the card's Continue button: `useTourDirector` clears `lastDone` once the camera is home, and the next task appears.
- `src/story/`: the story's data and logic.
  - `projects.ts`: **portfolio content** (`PROJECTS`, `CONTACT`, `EXPERIENCE`, `EDUCATION`, `CONFIG.githubUser`). It currently holds TODO placeholders that the owner will replace. Each project's optional `demo` drives its landmark's mini demo. The demos are tied to landmark kinds: `commit` → lighthouse top, `breathing` → lighthouse base, `song` → pond, `milestone` → tree.
  - `demos.ts`: the demo store (`useDemoStore`: commit, breathing samples, cue state), plus `loadCommit`, `loadBreathing` and `playCue`. `playCue` plays `demo.audio`, or a WebAudio jingle when there is none.
  - `githubCommit.ts`: the latest public PushEvent from the GitHub API (falling back to fetching the head commit), cached in localStorage for 30 minutes. It resolves null on failure or a TODO username, and the fallback from `projects.ts` shows instead.
  - Sample breathing data lives in `public/data/breathing.json`.
  - `progress.ts`: tour progress in localStorage (`{ v, built }`, TOUR ids only). The story store calls `restore(loadProgress())` at module load and saves whenever `built` changes, so coming back from `/portfolio` resumes. A partial save replays the intro (with a welcome-back line) and then the next stop; a full save goes straight to the ending. Free-play edits are not saved. `autoBuild` is not saved. The HUD's "↺ Restart" clears the save and reloads.
  - `quests.ts`: the ordered quests. Each has a dialogue line, a `tool`, an `area`, a `condition(snapshot, area)`, `clicks` (the tile offsets that one click on the target plays) and a `landmark` kind. The tour stops (`TOUR`) are lighthouse base, lighthouse top, pond and big tree. The pier is `auto`: `startDocking()` builds it in the ending.
  - The pond quest's `clicks` are the Cue lake's shape (six tiles in a band across the default view). `placeLandmark` digs any of them still dry, then locks them plus the bridge's bank ends (`POND_BRIDGE_ENDS` in `landmarks.ts`). The lake geometry (bridge, lily pads, reeds, stepping stones) is laid out in tile offsets tuned to that shape, so changing the shape means re-placing those. A hidden `LakeHitArea` over the water tiles makes the whole lake clickable for Cue.
  - `questBuild.ts`: `runQuestBuild()` plays a quest's `clicks` through `applyTool` (`src/scene/applyTool.ts`), `stepMs` apart (default 200ms). It is triggered by clicking the QuestGhost ring, its "Click here" pill, a tile on the target, or a landmark standing on it. There is no per-step skip; the ways out of the tour are "Build it all" (`buildAll`) and the skip link to `/portfolio` (`skipStep` remains for tests).
  - `useTourDirector.ts`: auto-advances the intro (`INTRO_MS`) using a timer, and shows the next task `FLY_MS` after a tour card is closed.
  - "⚡ Build it all" (`buildAll()` sets `autoBuild`): the same director plays the remaining stops hands-free. It runs each build at `AUTO_SPEED`, lets the camera fly in, and closes each card after `AUTO_CARD_MS`, then the normal ending follows (about 5s per stop).
  - `landmarks.ts`: `placeLandmark()` picks an anchor tile and claims its tiles. `findPier()` finds the pier. `PIER_DIR` (-1 = west) sets which way the pier reaches; the pier model, its sparkles, the dock flag and `dockPath` all follow it.
  - `useQuestWatcher.ts`: re-checks the active quest only when an island version counter changes. It also pins the island's `tool` to `selectToolLock()` (the current quest's tool, from intro until the last quest is done) and switches any other tool straight back. The Toolbar disables the other buttons. All tools unlock in the ending.
  - `useEndingDirector.ts`: starts docking, then calls `finishStory()`.
  - `shipPath.ts`: the arrive and dock curves. The ship sails in from the top-left of the default view (-x, since the camera sits at +x +z) in `ARRIVE_SECONDS` (2s) and waits off the island's west shore, where the pier quest builds out. Moving the waiting spot to another side means changing `ARRIVE_PATH`, `PIER_DIR` and the pier quest's `area` together.
- `src/scene/`: R3F components (Island, Ocean, Ponds, Stones, Plants, Particles, Interaction, CameraRig, Lighting, HoverHighlight, PerfGovernor).
  - `CameraRig` uses `setViewOffset` (`viewShift`: large on small screens, small on wide ones) so the island sits above the dialogue and toolbar. In dev it exposes `window.camera` for headless tests.
  - `CameraRig` also flies to `focus` (`focusPose`) and back home, over `FLY_MS`. On wide screens it frames the landmark left of centre, beside the centre-right card. On phones (≤640px, where the card is a bottom sheet) it frames the landmark high. The controls' target stays on the y = 0.5 plane, because `onChange` clamps it there. Controls and tools are off while `focus` is set.
  - `Lighting` owns the sky, fog and lights, and eases the sunset (`sunset.ts`).
- `src/scene/story/`: Ship, Landmarks, QuestGhost (the ring over the task area, with sonar waves, a light column, a bobbing marker, and a bouncing drei `Html` "Click here" / "Tap here" pill), and the landmark and ship geometry.
  - Landmarks covers the pop animation, the tree's sapling growth (the tree is a grove over the 3x3 tiles around it, which `placeLandmark` clears and locks, with `GroveLife` butterflies and fireflies that brighten at sunset), click to open the card, the lighthouse beam, the pond ripples and the dock flag.
  - It also renders the demos: the commit label (drei `Html`), the base glow and lamp that breathe while the Breathing card is open, and a pond click that plays Cue with fast ripples and a "Recognized" bubble.
  - In-world `Html` labels use `zIndexRange` [2, 0] so they stay under the cards.
  - `shipGeometry.ts` is a pirate ship (dark sails, Jolly Roger, cannons) merged into one mesh. Its sails are swung off square (`BRACE`) so they face the camera rather than showing their edge.
- `src/ui/`: the Toolbar. During the tour it renders only the phone-placement Dialogue, then slides in for free play. `src/ui/story/` holds StoryHud, Hero (the name and pitch shown during the intro), Dialogue, ProjectCard, ProjectBody, ProjectDemo, PirateAvatar and `Story.css`.
  - `ProjectCard` sits centre-right (or as a bottom sheet on phones) and fades in after the camera lands. It shows the captain's done line, media (an image, GIF or `.mp4`/`.webm`), title, pitch, `result`, the demo block (`ProjectDemo`), chips, links, "Download CV" (`CONTACT.cv`, a placeholder in `public/cv.pdf`), and Continue or Close. The Dialogue hides while any card is open.
  - `Dialogue` is mounted twice: `placement="ship"` in `App` and `placement="toolbar"` in the Toolbar. Each renders only on its own screens (`BESIDE_SHIP` media query: at least 900px wide and over 500px tall). The two copies keep separate intro state.
  - On wide screens the bubble floats beside the ship. `Ship.tsx` projects the ship to screen coordinates every frame and calls `setShipScreen()` in `shipBubble.ts`. That module places the bubble left of the ship, narrowed to fit, or below the ship near the left edge, and restyles it only when its rounded position changes.
  - `PirateAvatar` is the captain's portrait, drawn in inline SVG.

## Gotchas

- In `completeQuest` and `skipAll`, set story state **before** placing the landmark. Placing a landmark edits the island, which re-runs the quest watcher.
- Story actions called from store subscribers (`useEndingDirector`) must guard against re-entry. `startDocking` checks `shipState === 'waiting'` and uses a single `set`.
- `skipAll` (dev and tests only; the HUD's "Build it all" is `buildAll`, which plays the stops) places landmarks in quest order, because the lighthouse top needs its base.
- Keep frame-time clamps loose (`Math.min(dt, 0.25)`). A tight clamp makes animations take far longer on slow machines.
- Landmarks call `stopPropagation` on pointer events so clicking them doesn't fire a tool.
- Don't add Rolldown `advancedChunks`/manual vendor chunks. A `three` vendor chunk crashed production with "m is not a function". Without `includeDependenciesRecursively: false` it also pulled react-dom out of the page chunk. The lazy `App` import is the only split. Check `npx vite preview` after any build config change, because dev mode won't show it.
- The ship docks on the far side of the pier (`ALONGSIDE` negative) so it doesn't hide the pier from the camera.

## Testing **headless**

Use playwright-core with the cached chromium headless shell. The playwright-core in `~/.npm/_npx` may expect a newer browser build than the one cached, so pass `executablePath` pointing at `~/Library/Caches/ms-playwright/chromium_headless_shell-*/…/chrome-headless-shell`. Launch it with the `--use-angle=swiftshader --enable-unsafe-swiftshader` flags and run the dev server with `npx vite --port 5179 --strictPort`.

Drive states through `window.story.getState()` and `window.island.getState()`, for example `window.story.getState().skipAll()`. To click a world point, project it with `window.camera.position.clone().set(x, y, z).project(window.camera)`.

Phone-sized viewports open the plain page, so add `?tour` to test the island on them.

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
- **Outreach pass:** a second 5-phase plan is in `~/.claude/plans/pasted-content-id-7ae0-i-want-mossy-rivest.md`.
  - Phase 1 is done: hero, decor, one-click tasks, camera lock, hidden toolbar, auto-advancing dialogue.
  - Phase 2 is done: camera fly-to, centered cards with Continue, landmarks reopen their cards in free play.
  - Phase 3 is done: landmark mini demos.
  - Phase 4 is done: the `/portfolio` page, lazy 3D, phones see the page first, the centered contact card with a photo.
  - Phase 5 is done: `?for=` greeting, loading screen, OG and Twitter tags with the preview image, analytics hook, non-blocking font. All 5 phases of the outreach pass are complete.
- The owner will supply real project and contact content for `src/story/projects.ts`.
