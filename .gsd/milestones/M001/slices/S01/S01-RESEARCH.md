# S01 — Core Premium Unlock — Research

**Date:** 2026-05-18

## Summary

S01 unlocks GDevelop's premium features by modifying 3 files at the definition site, using a return-value bypass pattern. No per-caller patching is needed — the changes propagate automatically to all ~15+ consumers. The approach is low-risk, well-understood, and validated against the actual codebase.

**Requirements served:** R001 (subscription bypass), R002 (limits bypass), R003 (watermark disable).

## Recommendation

Make three surgical edits:

1. **Usage.js** — `hasValidSubscriptionPlan()` → return `true` always
2. **Usage.js** — `getUserLimits()` → return hardcoded max-limits object (no API call)
3. **Watermark.cpp** — Constructor default and `UnserializeFrom` fallback: `showWatermark(false)`

No other files need changes. This is lightweight work.

## Implementation Landscape

### Key Files

- **`newIDE/app/src/Utils/GDevelopServices/Usage.js`** — Contains both `hasValidSubscriptionPlan()` (line ~541) and `getUserLimits()` (line ~445). These are the two choke points for all premium gating. Flow-typed. `getUserLimits` is called by 2 callers. `hasValidSubscriptionPlan` is called by ~15 callers.
- **`Core/GDCore/Project/Watermark.cpp`** — Contains `Watermark` constructor (line ~13) defaulting `showWatermark` to `true`, and `UnserializeFrom` (line ~21) with the same default. The runtime (`runtimewatermark.ts`) already reads `showWatermark` and renders conditionally — changing the C++ default is sufficient.

### Build Order

1. **Watermark.cpp** — Simplest change. Two locations: constructor default and `UnserializeFrom` fallback. Both change `true` → `false`.
2. **Usage.js — `hasValidSubscriptionPlan()`** — Return literal `true` instead of making an API call.
3. **Usage.js — `getUserLimits()`** — Return a hardcoded max-limits `Limits` object satisfying the Flow exact type. Must include all fields: `quotas`, `capabilities`, `credits`, etc. The `ai.availablePresets` array stays empty (S03 independently injects BYOK preset via `fetchAiSettings()`).

### Verification Approach

1. Run `node scripts/test.js` or equivalent to check for Flow/JS compilation errors
2. Launch the Electron app and confirm:
   - No subscription prompt appears
   - All premium features accessible
   - No "Made with GDevelop" watermark on preview
3. Check watermark via `npm start -- --check-watermark` or by exporting a preview

## Constraints

- Flow type annotations must be preserved — the `Limits` object returned by `getUserLimits()` must match the exact Flow type
- No new npm dependencies
- C++ changes must follow existing GDCore conventions (constructor + serialization patterns)

## Common Pitfalls

- **Flow type mismatch** — The hardcoded `Limits` object must satisfy the exact shape. The `quotas` and `prices` sub-objects can be empty `{}` since all consumers guard with `&&`/optional chaining.
- **Watermark runtime override** — Verify the runtime doesn't hardcode `showWatermark: true` independently of the C++ default. Check `newIDE/app/src/GameEngine/EngineCommands/runtimewatermark.ts`.
