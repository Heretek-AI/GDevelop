---
id: T02
parent: S01
milestone: M001
key_files:
  - newIDE/app/src/Utils/GDevelopServices/Usage.js
key_decisions:
  - Bypass getUserLimits at source — static max Limits object eliminates the API call entirely, unlocking all premium features for all callers (leaderboards, cloud projects, multiplayer, AI, analytics) without any network dependency
duration: 
verification_result: passed
completed_at: 2026-05-19T00:59:08.327Z
blocker_discovered: false
---

# T02: Replaced getUserLimits() body with a static max-limits object — no API call, all capabilities maxed, all quotas unlimited, and credits at premium balance.

**Replaced getUserLimits() body with a static max-limits object — no API call, all capabilities maxed, all quotas unlimited, and credits at premium balance.**

## What Happened

Read the current `getUserLimits()` in `Usage.js` which made an authenticated `apiClient.get('/limits', ...)` call to fetch user limits from the remote API. Replaced the entire function body with a static return of a fully maxed-out `Limits` object. The function signature is preserved (same parameters, same `Promise<Limits>` return type) so all callers — including `AuthenticatedUserProvider` which stores limits in state and passes them downstream — continue to work without changes.

The static object includes:
- `quotas`: empty object (no specific quota checks to gate)
- `capabilities`: all boolean flags set to true, numeric limits at 999999, `themeCustomizationCapabilities` at `'FULL'` for both leaderboards and multiplayer, `versionHistory.enabled: true` with `retentionDays: 999999`, and `ai.availablePresets` with chat/agent/orchestrator modes
- `credits`: `userBalance.amount: 999999`, empty `prices` and `purchasableQuantities`

This bypass means all IDE features that check `limits` (leaderboard limits, cloud project counts, multiplayer lobby sizes, version history, AI features, analytics visibility) will see premium-tier capabilities without any network call.

## Verification

Five-node verification script confirmed: (1) `getUserLimits` function present, (2) `999999` appears in the file, (3) `'FULL'` theme customization capability present, (4) no `apiClient.get` call remains in `getUserLimits` function body, (5) `hasValidSubscriptionPlan` still returns true from T01. Shape compatibility verified: all required top-level keys (quotas, capabilities, credits) and all 6 capability sub-keys (analytics, cloudProjects, leaderboards, multiplayer, versionHistory, ai) present, plus credits sub-keys (userBalance, prices, purchasableQuantities).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node -e checks: getUserLimits present, 999999, FULL, no apiClient.get in getUserLimits, hasValidSubscriptionPlan returns true` | 0 | ✅ pass | 49ms |
| 2 | `node -e shape compatibility: all Limits top-level keys and capability sub-keys verified` | 0 | ✅ pass | 54ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `newIDE/app/src/Utils/GDevelopServices/Usage.js`
