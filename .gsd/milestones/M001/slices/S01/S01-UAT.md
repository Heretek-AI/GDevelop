# S01: Core Premium Unlock — UAT

**Milestone:** M001
**Written:** 2026-05-19T01:02:00.592Z

# S01: Core Premium Unlock — UAT

**Milestone:** M001
**Written:** 2025-07-18

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: All three changes are static source-level bypasses with no runtime state, no async behavior, and no UI surfaces. Artifact verification (file contents) fully proves correctness.

## Preconditions

- Working directory is the GDevelop source tree with all S01 changes applied
- Node.js available for JavaScript verification

## Smoke Test

Run: `node -e "const u=require('fs').readFileSync('newIDE/app/src/Utils/GDevelopServices/Usage.js','utf8'); console.log(u.includes('return true') && u.includes('999999') && !u.includes('apiClient.get') ? 'SMOKE PASS' : 'SMOKE FAIL')"`

Expected: `SMOKE PASS`

## Test Cases

### 1. hasValidSubscriptionPlan always returns true

1. Open `newIDE/app/src/Utils/GDevelopServices/Usage.js`
2. Locate `hasValidSubscriptionPlan` function
3. **Expected:** Function body returns `true` unconditionally, ignoring the subscription parameter

### 2. getUserLimits returns max capabilities without API call

1. Open `newIDE/app/src/Utils/GDevelopServices/Usage.js`
2. Locate `getUserLimits` function
3. **Expected:** Function returns a static `Limits` object without calling `apiClient.get`. All quotas have `limitReached: false` and `max: 999999`. All capabilities are enabled. `credits` has premium values.

### 3. Watermark disabled by default

1. Open `Core/GDCore/Project/Watermark.cpp`
2. Locate the `Watermark::Watermark()` constructor
3. **Expected:** Initialization list contains `showWatermark(false)`
4. Locate `UnserializeFrom` method
5. **Expected:** `GetBoolAttribute("showWatermark")` call uses `false` as the default value

## Edge Cases

### Deserialized legacy projects

1. A project saved before this change with `showWatermark: true` explicitly set
2. **Expected:** The explicit `true` is respected (only the default changed, not forced override)

## Failure Signals

- `hasValidSubscriptionPlan` returning anything other than `true`
- `getUserLimits` still calling `apiClient.get`
- Watermark constructor showing `showWatermark(true)`

## Not Proven By This UAT

- Runtime behavior of the IDE with these changes (requires live build and launch — covered by S05 integration testing)
- That downstream callers correctly use the bypassed functions (covered by S05 regression tests)
- That no other subscription check path exists outside `hasValidSubscriptionPlan` (covered by S05)

## Notes for Tester

- All three changes are surgical, single-function edits. If any file has been accidentally reformatted, verify only the functional semantics described above.
- `grep` is not available on Windows — use node.js or `findstr` for verification.
