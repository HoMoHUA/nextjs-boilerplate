# Studio scene upgrade

The selected visual reference is [the studio concept](concepts/office-studio-concept.png).
This branch implements an interactive WebGL studio based on that direction.
The concept is an offline illustration: the current authored faces, hairstyles,
clothing, lighting and furniture are an approximation, not an identical recreation.

## What changed

- Authored GLB character parts replace clustered spheres and capsule bodies.
  Face contours, eyelids, six hairstyles, tailored clothing, hands and shoes
  remain articulated by the existing status-driven animation system.
- Oak desks, ergonomic fabric chairs, monitor arms, lamps, drawers, mugs,
  plants, lounge seating and an espresso machine have distinct forms/materials.
- Staggered oak floorboards, plaster cutaway walls, a garden window, shelving
  and fitted cabinetry establish the room. The rear aisle stays in front of
  the cabinetry.
- Woven clothing uses authored UVs, fine bump detail and soft fabric sheen.
  Sunlight through the window casts moving shadows; a woven lounge rug and
  planted low partition complete the foreground.
- Desktop contact shading uses GTAO with bounded multisampling. Compact views
  use the lighter direct-render path, reduced DPR and a smaller shadow map.
- A scene error boundary preserves conversations when a model or texture fails.
  Retry clears rejected loader promises and reopens the studio.

Topic identity, message history, send targets, room selection, permissions and
backend routing are unchanged. Empty desks have switched-off screens. The
six-person screenshots use an isolated browser-only fixture; they do not show
live workers or prove Telegram/model connectivity.

## Assets and reproduction

All runtime models and texture files are committed under `public/`; startup
does not download third-party 3D assets, HDR maps, fonts or texture services.
Seven GLBs total approximately 2.16 MB; four JPEG maps total 371 KB. The
character library stores all hairstyle/accessory variants together; an instance
uses about 19.3–20.6k triangles. Geometry is shared across instances.

Blender 4.3.2 generated the models from the included authoring scripts:

```bash
blender --background --threads 2 --python scripts/art/build_characters.py
blender --background --threads 2 --python scripts/art/build_furniture.py
```

Rebuilding models is optional. Standard app development remains `npm ci` and
`npm run dev`. For a standalone deployment, copy both `.next/static` and
`public` beside the generated server, as the existing production runbook
requires; otherwise the new models and textures will not be served.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
node integrations/run_topic_tests.cjs
node integrations/run_topic_tests.cjs ../lib/topic-office.test.ts
node integrations/test_english_ui.cjs
```

Portable local browser checks require Python Playwright and Chromium. They
intercept integration APIs inside a new browser context and never send a chat
message or use a production credential:

```bash
CHROMIUM_BIN=/usr/bin/chromium python integrations/qa_studio.py --base-url http://127.0.0.1:3003
CHROMIUM_BIN=/usr/bin/chromium python integrations/qa_studio_failure.py http://127.0.0.1:3003
```

The browser checks cover the actual models/materials, character selection, team
editing, mobile layout/drawer, persisted selection, failed-asset isolation and
retry. Desktop captures use 1600×1000; mobile uses 390×844, both at device scale1.
CI uses Chromium's software WebGL renderer. No FPS claim is made for physical
Android/iOS devices; those devices and live backends were not available here.

## Actual output

- [Desktop screenshot](screenshots/studio-desktop.png)
- [Mobile screenshot](screenshots/studio-mobile.png)
- [Reference and actual render comparison](screenshots/studio-comparison.jpg)

These are screenshots of the running app, not a generated replacement for the
WebGL scene. The concept illustration's close-up facial sculpt, dense hair,
tailored garment variety and photographic finish remain beyond this version.
See the root `design-qa.md` for the fidelity assessment and verified behavior.
