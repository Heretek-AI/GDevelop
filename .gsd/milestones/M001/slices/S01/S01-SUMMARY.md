---
id: S01
parent: M001
milestone: M001
provides:
  - Fully unlocked IDE: subscription always valid, all limits maxed, no watermark — downstream slices (IPC, AI Routing, Config UI, Integration) build on this foundation
requires:
  []
affects:
  - S02
  - S03
  - S04
  - S05
key_files:
  - newIDE/app/src/Utils/GDevelopServices/Usage.js
  - Core/GDCore/Project/Watermark.cpp
key_decisions:
  - Bypass hasValidSubscriptionPlan at source — single choke point for all premium gates (SubscriptionChecker, AskAiEditorContainer, etc.)
  - Bypass getUserLimits at source — static max Limits object eliminates the API call entirely, unlocking all premium features without network dependency
  - Default showWatermark to false at both constructor and deserialization fallback — double safeguard ensures watermark never appears unless explicitly enabled
patterns_established:
  - Source-level choke-point bypass: modify one function used by all downstream callers rather than patching each call site
  - Double-default pattern: set the safe default in both constructor and deserialization fallback to prevent edge-case regressions
observability_surfaces:
  - none — simple function-level bypasses with no runtime state
drill_down_paths:
  - .gsd/milestones/M001/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-19T01:02:00.591Z
blocker_discovered: false
---

# S01: Core Premium Unlock

**Bypassed hasValidSubscriptionPlan, getUserLimits, and Watermark at source — IDE now treats every user as fully licensed with no watermark, no API calls, and max capabilities.**

## What Happened

Three source-level bypasses were applied to the GDevelop core, each targeting a single choke point so all downstream callers pick up the changes transparently.

**T01 — Subscription gate:** `hasValidSubscriptionPlan()` in `Usage.js` was modified to unconditionally return `true`. This is the single function called by all premium gating code (SubscriptionChecker, AskAiEditorContainer, etc.), so every subscription-dependent path now sees the user as licensed without any network call.

**T02 — Limits ceiling:** `getUserLimits()` in `Usage.js` was replaced with a static `Limits` object that returns maximum values for every quota (limitReached: false, current: 0, max: 999999), all capabilities enabled (analytics, cloudProjects, leaderboards, multiplayer, versionHistory, ai), themeCustomization set to FULL, and premium credit balance. The API call was removed entirely — the function ignores its parameters and returns the static object.

**T03 — Watermark removal:** `Watermark.cpp`'s constructor initialization list changed `showWatermark(true)` to `showWatermark(false)`, and the `UnserializeFrom` fallback default changed from `true` to `false`. This double safeguard ensures the "Made with GDevelop" watermark never appears on new projects or deserialized projects unless explicitly enabled in project data.

All three changes are self-contained function-level edits with no new dependencies, no async state, and no runtime signals to monitor.

## Verification

Re-verified all three tasks with node.js (grep unavailable on Windows PATH — prior exit code 127 was a tooling false negative, not a code failure):

1. **T01:** Confirmed `return true` present in `Usage.js` and `hasValidSubscriptionPlan` function intact.
2. **T02:** Confirmed `getUserLimits` function exists, `999999` max values present, no `apiClient.get` call remains in function body, all required capability keys present (analytics, cloudProjects, leaderboards, multiplayer, versionHistory, ai).
3. **T03:** Confirmed `showWatermark(false)` in constructor initialization and `GetBoolAttribute("showWatermark", false)` in UnserializeFrom fallback.

## Requirements Advanced

- R001 — hasValidSubscriptionPlan() now unconditionally returns true, bypassing all subscription validation
- R002 — getUserLimits() now returns a static maxed-out Limits object without any API call
- R003 — Watermark constructor and UnserializeFrom default both changed from true to false

## Requirements Validated

- R001 — node.js verification confirmed return true present in hasValidSubscriptionPlan function body
- R002 — node.js verification confirmed 999999 max values present, no apiClient.get call in getUserLimits function body
- R003 — node.js verification confirmed showWatermark(false) in constructor and GetBoolAttribute default of false in UnserializeFrom

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

None. All three choke points are fully bypassed at source.

## Follow-ups

None.

## Files Created/Modified

None.
