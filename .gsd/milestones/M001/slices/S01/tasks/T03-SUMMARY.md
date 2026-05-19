---
id: T03
parent: S01
milestone: M001
key_files:
  - Core/GDCore/Project/Watermark.cpp
key_decisions:
  - Default showWatermark to false at both constructor and deserialization fallback — double safeguard ensures watermark never appears unless explicitly enabled in project data
duration: 
verification_result: passed
completed_at: 2026-05-19T01:00:35.441Z
blocker_discovered: false
---

# T03: Changed Watermark::Watermark() constructor and UnserializeFrom default from showWatermark(true) to showWatermark(false) — new projects and deserialized projects without the attribute no longer show the GDevelop watermark.

**Changed Watermark::Watermark() constructor and UnserializeFrom default from showWatermark(true) to showWatermark(false) — new projects and deserialized projects without the attribute no longer show the GDevelop watermark.**

## What Happened

Modified two defaults in Core/GDCore/Project/Watermark.cpp:
1. Constructor initialization list: `showWatermark(true)` → `showWatermark(false)` — new projects created in the IDE will not display the "Made with GDevelop" watermark by default.
2. UnserializeFrom fallback: `GetBoolAttribute("showWatermark", true)` → `GetBoolAttribute("showWatermark", false)` — existing projects that lack the attribute in their serialized data will also default to no watermark.

This closes out the three slice requirements: R001 (hasValidSubscriptionPlan → true, done in prior task), R002 (getUserLimits → max limits, done in prior task), and R003 (Watermark defaults → false, done here). All three bypasses are at their definition sites, so downstream callers pick them up automatically.

## Verification

Verified via ripgrep (grep not available on Windows PATH — exit 127 was a tooling error, not a code failure):

1. `rg "showWatermark" Core/GDCore/Project/Watermark.cpp` — confirms constructor has `showWatermark(false)` and UnserializeFrom has `GetBoolAttribute("showWatermark", false)`
2. `rg "return true" newIDE/app/src/Utils/GDevelopServices/Usage.js` — confirms hasValidSubscriptionPlan returns true (done in prior task)
3. `rg "maximumCount: 999" newIDE/app/src/Utils/GDevelopServices/Usage.js` — confirms getUserLimits returns max limits (done in prior task)

All three slice requirements verified at source level.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `rg "showWatermark" Core/GDCore/Project/Watermark.cpp` | 0 | ✅ pass — constructor and UnserializeFrom both default to false | 85ms |
| 2 | `rg "return true" newIDE/app/src/Utils/GDevelopServices/Usage.js` | 0 | ✅ pass — hasValidSubscriptionPlan returns true (prior task) | 72ms |
| 3 | `rg "maximumCount: 999" newIDE/app/src/Utils/GDevelopServices/Usage.js` | 0 | ✅ pass — getUserLimits returns max limits (prior task) | 68ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `Core/GDCore/Project/Watermark.cpp`
