# Studio design QA

## Findings

- **P1 — Exact reference fidelity is not achieved.** The approved illustration
  has more nuanced facial sculpting, fine flowing hair, varied tailored outfits
  and a photographic material/light finish. The authored GLBs improve the old
  primitives substantially, but retain simpler stylized faces and hair locks.
  Evidence: `docs/screenshots/studio-comparison.jpg`. Closing this gap needs
  another character/environment art pass; build success is not proof of a match.
- **P2 — Layout and decorative density differ.** The runtime preserves eight
  desk positions and four meeting seats for existing topic pagination and handoff
  behavior. The illustration has a denser, less regular furniture arrangement,
  different coffee-corner placement and more layered planting. These differences
  are visible and are not being counted as an identical recreation.

## Comparison target and evidence

- Source truth: `docs/concepts/office-studio-concept.png`, 1536×1024.
- Actual production build: Next.js standalone, internally served on port3003.
- Desktop: `docs/screenshots/studio-desktop.png`, 1600×1000 CSS pixels and
  physical pixels, deviceScaleFactor1.
- Scene region: `docs/screenshots/studio-scene.png`, 1316×733. This is a browser
  capture including composited name labels, not an offline renderer or generated
  background replacing the interactive canvas.
- Mobile: `docs/screenshots/studio-mobile.png`, 390×844, deviceScaleFactor1.
- Full comparison: `docs/screenshots/studio-comparison.jpg`. The left scene panel
  of the art board is compared with a tighter crop of the actual canvas; aspect
  ratios are preserved. The source is an art board, not an app viewport, so this
  is an art-direction comparison, not a pixel-difference score.
- State: six idle, browser-only fixture agents, cream theme, folded side panels.
  The fixture never sends a message, reads a live Telegram group or calls a model.
  Its presence/status must not be interpreted as live activity.

The source and implementation were opened together in the combined comparison.
Focused sculpt/pose previews were also inspected while authoring; the final
runtime close-up is still visibly simpler than the right-side portraits in the
concept. The source contains no mobile design; the mobile check evaluates the
existing responsive product behavior rather than claiming a mobile reference match.

## Required fidelity surfaces

- **Typography:** existing app typography, English controls, topic/data labels
  and accessible names are preserved. The art board's editorial title is not an
  application header and was not substituted for the product's real controls.
- **Spacing/layout:** full-room desktop framing and projected name labels were
  inspected; mobile crops peripheral architecture while keeping all six fixture
  labels and the composer in bounds. Topic/seat identity remains unchanged.
- **Colors/materials:** warm oak, ivory plaster, sage fabric, ceramic, metal,
  woven clothing, sunlight through the window and a garden image are implemented.
  A lounge rug and planted partition restore more of the reference's foreground.
- **Image/asset quality:** seven valid, authored, locally served GLBs; four local
  JPEG maps. They are actual interactive geometry, not a flattened scene image.
  All GLB primitives have finite attributes and valid indices. Character meshes
  include UVs for woven surface detail. Exact sculpt/texture fidelity remains open.
- **Copy/content:** existing UI copy and live-data semantics are preserved;
  the only new product copy is scene loading/failure/retry messaging. The
  English-only regression check passed.

## Comparison and correction history

1. Initial primitives: clustered hair, round body segments, flat furniture and
   an empty floor were replaced with authored geometry, materials and architecture.
2. Early sculpt review found protruding eyes, a rectangular shirt inset and hair
   intersections. The eye opening/iris, neckline and hair cap were reshaped.
3. Pose review found hovering seated feet and pelvis. Seated shin length blends
   to the floor, shoes retain their shape, and pelvis/cushion contact was checked.
4. Code review found a rear-wall/aisle collision, frozen contact shadows, camera
   bounds not recentering, and lost desktop antialiasing. The rear aisle moved
   forward, dynamic shadows/GTAO replaced the frozen bake, controls trigger a
   camera fit after mounting, and composer targets use bounded multisampling.
5. Fault injection proved that a missing model could unmount the messaging UI.
   A scene boundary now retains conversation controls and clears rejected loader
   promises on retry. The missing-asset/recovery browser test passed.
6. Final visual pass added cloth UVs/sheen, directional window shadows, a woven
   lounge rug and planting. The production build and desktop/mobile browser checks
   were rerun. Post-fix evidence is in the screenshots linked above.

## Functional validation

- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- Both existing topic regression fixtures and English UI fixture: passed.
- `integrations/qa_studio.py`: passed all five behavior groups on the final build.
  Selected agent, team editor, mobile drawer/composer and reload persistence work.
  Zero page errors, zero console errors, zero failed model/texture responses.
- `integrations/qa_studio_failure.py`: asset failure isolation and retry passed.
- GLTFLoader validation: all seven models load; all attributes are finite and
  indices refer to real vertices. All four JPEG maps decode.
- Physical mobile GPU/FPS and live backend connections were not tested. Existing
  deployment/auth prerequisites were not changed by this visual feature.

## Implementation checklist

- [x] Replace primitive character/furniture appearance with authored 3D assets.
- [x] Add textured architecture, lighting, scene resilience and responsive checks.
- [x] Preserve the existing topic and messaging contracts.
- [x] Capture actual desktop/mobile results and validate interactions.
- [ ] Reach the approved concept's exact facial, hair, garment and environment fidelity.

Functional checks pass. Exact visual acceptance remains blocked by the P1/P2
differences above; this report does not claim that the render is identical.

final result: blocked
