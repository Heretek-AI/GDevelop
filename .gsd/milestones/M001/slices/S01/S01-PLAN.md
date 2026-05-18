# S01: Core Premium Unlock

**Goal:** IDE launches with subscription valid, max limits, no watermark
**Demo:** IDE launches with subscription valid, max limits, no watermark

## Must-Haves

- R001: hasValidSubscriptionPlan() always returns true. R002: getUserLimits() returns hardcoded max-limits without API call. R003: Watermark constructor and deserialization default to showWatermark: false.

## Proof Level

- This slice proves: contract

## Integration Closure

Three surgical edits at definition sites. All downstream callers pick up changes automatically. T01 touches C++ constructor+serialization defaults. T02+T03 touch the same Usage.js file. No new wiring needed — these are pure bypass edits at the source of truth.

## Verification

- None — these are compile-time/default changes. No runtime signals added. Verification is via grep on the edited files and existing test suite pass.

## Tasks

- [ ] **T01: Disable watermark in Watermark.cpp defaults** `est:10m`
  Why: R003 requires the Made with GDevelop watermark to be disabled by default. The Watermark.cpp constructor initializes showWatermark to true, and UnserializeFrom falls back to true when the attribute is missing.
  - Files: `Core/GDCore/Project/Watermark.cpp`
  - Verify: grep -q "showWatermark(false)" Core/GDCore/Project/Watermark.cpp

- [ ] **T02: Bypass hasValidSubscriptionPlan to always return true** `est:10m`
  Why: R001 requires hasValidSubscriptionPlan() to return true unconditionally, removing all subscription gating. Called by ~15 consumers across the IDE.
  - Files: `newIDE/app/src/Utils/GDevelopServices/Usage.js`
  - Verify: grep -q "return true" newIDE/app/src/Utils/GDevelopServices/Usage.js

- [ ] **T03: Bypass getUserLimits with hardcoded max-limits object** `est:15m`
  Why: R002 requires getUserLimits() to return maximum values for all limits without making an API call. Removes all caps on builds, projects, AI tokens, etc. Must return a valid Limits Flow type.
  - Files: `newIDE/app/src/Utils/GDevelopServices/Usage.js`
  - Verify: grep -q "maximumCount: 999" newIDE/app/src/Utils/GDevelopServices/Usage.js

## Files Likely Touched

- Core/GDCore/Project/Watermark.cpp
- newIDE/app/src/Utils/GDevelopServices/Usage.js
