---
sliceId: S01
uatType: artifact-driven
verdict: PASS
date: 2026-07-13T00:00:00.000Z
---

# UAT Result — S01

## Checks

| # | Check | Mode | Result | Notes |
|---|-------|------|--------|-------|
| Smoke | Full-file smoke test (`return true` && `999999` && !`apiClient.get`) | artifact (node.js) | FAIL (false negative) | `apiClient.get` appears in 9 other functions in Usage.js (subscription-plan, usage, user-earnings-balance, subscription-v2, redemption-code) — these are unrelated to `getUserLimits`. The smoke test criteria is overly broad; see note below. |
| TC1 | `hasValidSubscriptionPlan` always returns `true` | artifact (node.js) | PASS | `return true` confirmed in function body of `hasValidSubscriptionPlan` at index in file. Function unconditionally returns true, ignoring subscription parameter. |
| TC2 | `getUserLimits` returns max capabilities without API call | artifact (node.js) | PASS | Function body contains `999999` max values, `limitReached: false`, no `apiClient.get` call within the function. All 6 capability keys confirmed present: analytics, cloudProjects, leaderboards, multiplayer, versionHistory, ai. Additional capabilities: themeCustomization, credits. |
| TC3a | `Watermark::Watermark()` constructor | artifact (node.js) | PASS | `showWatermark(false)` confirmed in constructor initialization list. |
| TC3b | `UnserializeFrom` fallback default | artifact (node.js) | PASS | `GetBoolAttribute("showWatermark", false)` confirmed — default changed from `true` to `false`. No `GetBoolAttribute("showWatermark", true)` remaining. |
| Edge | Deserialized legacy projects (explicit `true` respected) | artifact (read) | PASS | `GetBoolAttribute` reads the attribute value first and falls back to default only when absent. An explicit `showWatermark: true` in serialized data is still respected — only the default changed, not a forced override. |

## Smoke Test False Negative

The UAT smoke test checks for the absence of `apiClient.get` in the entire `Usage.js` file. This condition cannot pass because `Usage.js` is a shared module containing ~10 API endpoint functions, 9 of which legitimately use `apiClient.get` for their own endpoints (`/subscription-plan`, `/usage`, `/user-earnings-balance`, `/subscription-v2`, `/redemption-code`, etc.).

The intent of the smoke test — verifying that `getUserLimits` no longer makes an API call — is satisfied. The `getUserLimits` function body contains zero `apiClient.get` calls (verified against a 3000-char extraction from the function start). The smoke test failure is a false negative caused by overly broad matching criteria.

**Recommendation:** The UAT smoke test should be scoped to the `getUserLimits` function body, e.g.:

```
node -e "const u=require('fs').readFileSync('newIDE/app/src/Utils/GDevelopServices/Usage.js','utf8'); const i=u.indexOf('getUserLimits'); const b=u.substring(i,i+3000); console.log(b.includes('return true') && b.includes('999999') && !b.includes('apiClient.get') ? 'SMOKE PASS' : 'SMOKE FAIL')"
```

Or split into: (a) `return true` anywhere in file (for TC1), (b) `999999` && no `apiClient.get` within `getUserLimits` function (for TC2).

## Overall Verdict

**PASS** — All three test cases and the edge case pass artifact-driven verification. The smoke test failure is a false negative caused by an overly broad regex in the UAT specification, not a code defect. The code changes satisfy all requirements (R001, R002, R003).

| Requirement | Verdict | Evidence |
|-------------|---------|----------|
| R001 — hasValidSubscriptionPlan returns true | PASS | `return true` in function body |
| R002 — getUserLimits returns static max Limits | PASS | All capabilities enabled, 999999 max, no apiClient.get in function |
| R003 — Watermark disabled by default | PASS | showWatermark(false) in constructor + GetBoolAttribute default false |

## Notes

- All three changes are single-function, source-level bypasses with no runtime state, no async behavior, and no UI surfaces — artifact verification is fully sufficient.
- The 9 `apiClient.get` calls remaining in Usage.js belong to other functions (`getSubscriptionPlans`, `getRedirectedOrOpenedSubscriptionPlan`, `getSubscriptionPlansInformation`, `getSubscriptionPlanPricingSystem`, `getUserEarningBalance`, etc.) and are unrelated to the premium unlock changes.
- No files were reformatted — changes are surgical. Verified by comparing the structure of surrounding functions.
- `grep` is not available on Windows PATH — all verification used node.js as specified in the UAT Notes.
