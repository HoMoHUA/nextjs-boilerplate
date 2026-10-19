# Avatar Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Audit every requirement in the attached avatar proposal and start P0/P1 without changing topic routing or losing the approved studio work.

**Architecture:** Add a JSON-only, versioned appearance domain in `lib/avatar/`. Hydration captures the existing topic look before any new group-aware defaults; snapshots retain saved records and resolve genuinely new topics to deterministic defaults. An adapter projects supported appearance fields into the existing GLB renderer's `AgentLook`; future visual fields remain data until P2/P3.

**Tech Stack:** TypeScript, existing assertion runner, React external store, Three.js GLTFLoader for an offline asset census; no new dependencies.

**Spec:** `docs/AVATAR_UPGRADE_PLAN.fa.md` with decisions/coverage in `docs/AVATAR_UPGRADE_COVERAGE.fa.md`.

## Global Constraints

- Keep `arklyn-office-v3`; add a versioned property, never clear messages, history tombstones, topic selection or send target.
- Topic appearance keys contain exact group/topic identifiers, never topic names, activity or engine IDs.
- Unknown schema versions remain stored, use a safe fallback and cannot be silently replaced by editing.
- Software-owned UI/errors are English; source names/messages remain untouched.
- All work stays on `codex/office-studio-upgrade`; do not merge `Office`, deploy, restart bots, or send live test messages.
- Keep the current six legacy hairstyles/colors on migration; shared presets must not be mutated.
- P2–P7 remain planned; this increment does not claim an editor, LOD, final fidelity or real-device FPS.

## Review Focus

- Same topic number in two groups: independent records and defaults; Task 2 tests both keys.
- Future/malformed persisted schema: preserve the raw value and render safely; Tasks 2/3 test preservation through hydrate/snapshot/persist.
- Invalid color/unknown fields/oversized import: reject without losing the previous valid record; Task 2 tests the JSON boundary.
- Snapshot rename/reorder/worker changes: appearance, history/tombstones and native send target survive; Task 3 tests actual store/projection.
- Renderer downgrade/reload: V2 settings remain saved while supported legacy presentation is available; Tasks 2/3 test adapter and persistence.

---

### Task 1: Coverage and reproducible P0 asset baseline

**Files:** `docs/AVATAR_UPGRADE_COVERAGE.fa.md`, `integrations/avatar_asset_census.mjs`, `docs/benchmarks/avatar-assets.json`.

**Interfaces:** Consumes the seven local studio GLBs; produces a JSON report of file sizes, geometry totals and 1/6/12 visible-character estimates. Explicitly exclude claims about renderer calls/FPS/memory.

- [x] Record every FR, AVA item, cross-cutting requirement and intentional decision difference.
- [x] Load GLBs with existing GLTFLoader, validate indices/positions/UV/normals, count selected character parts using current six-hair/sleeve/accessory rules and preserve source hashes.
- [x] Run `node integrations/avatar_asset_census.mjs`; expect valid local assets and report that current character geometry exceeds the provisional 12k High target.
- [x] Commit the audit and baseline. P0 physical-device/visual-final gates remain open.

### Task 2: Appearance domain and safe migration

**Files:** create `lib/avatar/{types,catalog,validate,defaults,storage}.ts` and `lib/avatar/avatar.test.ts`.

**Interfaces:** `validateAppearance(unknown)` and `validateAvatarPreferences(unknown)` return discriminated validation results; `parseAvatarPreferences(string)` additionally bounds bytes. `topicAppearanceKey(groupId,topicId)` validates numeric string IDs without numeric conversion. `initializeAvatarPreferences(raw, topics, legacy)` captures legacy records only on first initialization; missing overrides afterwards mean defaults, including Reset. `createTopicLookResolver(raw)` validates once per projection; `resolveTopicLook(raw,groupId,topicId)` is the single-topic adapter. Pure Save/Reset helpers operate only on appearance records and return errors without mutation.

- [x] Write tests for group separation, exact IDs, clone isolation, enum/color/unknown-field/size limits, migration/idempotence, future-version preservation, Save/Reset isolation and downgrade preservation.
- [x] Run `node integrations/run_topic_tests.cjs ../lib/avatar/avatar.test.ts`; expect failure because the new domain is absent.
- [x] Implement the schema from section 7, strict closed validation, maximum 512 records, 128-character seed and 1 MiB JSON input. Defaults use group/topic for new records; migration clones `lookFor("topic:" + topicId)`.
- [x] Run the domain tests, existing topic suites, `npm run typecheck` and `npm run lint`; expect all passing.
- [x] Commit domain code and tests.

### Task 3: Store and scene projection integration

**Files:** modify `lib/types.ts`, `lib/store.ts`, `lib/topics.ts`; create `lib/avatar/avatar-store.test.ts`.

**Interfaces:** `OfficeState.avatarPreferences?: unknown` is an untrusted persisted-data boundary. Hydrate initializes legacy records; snapshot merge initializes genuinely new records. Topic projection uses `resolveTopicLook` without changing IDs/names/status/routing. The storage key and existing persistence mechanism remain intact; editor actions/storage warnings are P4.

- [x] Write tests using actual store functions and a storage boundary fixture: legacy reload, saved V2 reload, future version round-trip, new-topic defaults, snapshot preservation, none visibility/history/tombstones/send target, local rooms unchanged; forbid unexpected fetches.
- [x] Run `node integrations/run_topic_tests.cjs ../lib/avatar/avatar-store.test.ts`; expect missing migration/projection assertions to fail.
- [x] Hook the domain into hydrate, merge and projection; keep appearance independent from backend descriptors and UI selection.
- [x] Run both avatar suites, both topic suites, English UI test, lint/typecheck/build; expect all passing. Existing Python bridge suites are separate integration checks and any failures must be reported explicitly.
- [x] Record actual results, remaining gates and commit/push only the independent feature branch.

## Execution record

- User explicitly requested starting early phases; execute these reversible P0/P1 tasks inline. Do not stop to re-approve the already supplied schema or approved art direction.
- No production rollout or new visual catalog is part of this increment. Full phase roadmap and remaining acceptance criteria are in the coverage report.
- Ruling: Reset removes the override permanently; later snapshots do not recreate it. A missing V2 record uses group/topic defaults. Otherwise Reset would appear to undo itself after a sync.
- Ruling: If a first migration would exceed 512 records, keep the entire legacy fallback, without a partial migration. Save/Reset reject uninitialized settings. P4 must explain this limit rather than silently rehash other topics.
- Ruling: JSON input cap is 1 MiB rather than the initial 256 KiB proposal; a valid 512-record preference set must be able to round-trip through the parser. Record count and closed fields remain bounded.
- Review: independent read-only reviewer found migration overflow and repeated validation per actor. Both received regression coverage; validation now occurs once per scene projection. No real-device performance or final visual acceptance was inferred from this review.

- Completed checkpoints: `55da5d3` (audit/P0 census) and `cbc6165` (P1 domain/store/tests). Final functional browser QA: 5 groups passed, zero page/console/asset errors; evidence in `docs/benchmarks/avatar-foundation-browser.json`. The separate Python suite remains 24/25 with the documented existing filesystem-permission error.
