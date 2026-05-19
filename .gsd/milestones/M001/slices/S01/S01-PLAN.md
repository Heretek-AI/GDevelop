# S01: Core Premium Unlock

**Goal:** The IDE launches with subscription valid, max limits, no watermark — all gating functions bypassed at source.
**Demo:** IDE launches with subscription valid, max limits, no watermark

## Must-Haves

- [ ] GDevelop launches without errors\n- [ ] No subscription gate or upsell visible\n- [ ] No Made with GDevelop watermark on preview\n- [ ] `hasValidSubscriptionPlan()` returns `true` regardless of subscription\n- [ ] `getUserLimits()` returns premium capabilities without API call\n- [ ] Watermark.cpp defaults to `showWatermark=false`

## Proof Level

- This slice proves: contract

## Integration Closure

This slice is self-contained — it modifies the subscription/limits/watermark source functions. Downstream callers pick up the changes transparently.

## Verification

- none — simple function-level bypasses with no async state or runtime signals

## Tasks

- [x] **T01: Bypass hasValidSubscriptionPlan to always return true** `est:15m`
  Modify `hasValidSubscriptionPlan()` in `Usage.js` to always return `true` regardless of the subscription argument. This is the single choke point used by all premium gating callers (SubscriptionChecker, AskAiEditorContainer, etc.).
  - Files: `newIDE/app/src/Utils/GDevelopServices/Usage.js`
  - Verify: grep -q 'return true' newIDE/app/src/Utils/GDevelopServices/Usage.js && node -e "require('fs').readFileSync('newIDE/app/src/Utils/GDevelopServices/Usage.js','utf8').includes('hasValidSubscriptionPlan') && console.log('T01: hasValidSubscriptionPlan modified') || process.exit(1)"

- [x] **T02: Bypass getUserLimits to return max capabilities without API call** `est:30m`
  Modify `getUserLimits()` in `Usage.js` to skip the API call and return a static max-limits object. The function should ignore its parameters and return: a `Limits` object with `quotas` having maxed-out values (limitReached: false, current: 0, max: 999999), `capabilities` set to premium defaults (all booleans true, max counts at 999999, themeCustomization FULL, etc.), and a `credits` object with typical premium values.
  - Files: `newIDE/app/src/Utils/GDevelopServices/Usage.js`
  - Verify: grep -q '999999' newIDE/app/src/Utils/GDevelopServices/Usage.js && node -e "const u=require('fs').readFileSync('newIDE/app/src/Utils/GDevelopServices/Usage.js','utf8'); u.includes('getUserLimits') && !u.includes('apiClient.get') && console.log('T02: getUserLimits bypassed') || process.exit(1)"

- [x] **T03: Disable watermark default in Watermark.cpp** `est:10m`
  Change the default value of `showWatermark` from `true` to `false` in `Watermark.cpp`'s constructor initialization list. This prevents the GDevelop watermark from appearing on preview exports.
  - Files: `Core/GDCore/Project/Watermark.cpp`
  - Verify: grep -q 'showWatermark(false)' Core/GDCore/Project/Watermark.cpp && echo 'T03: watermark disabled'

## Files Likely Touched

- newIDE/app/src/Utils/GDevelopServices/Usage.js
- Core/GDCore/Project/Watermark.cpp
