---
estimated_steps: 18
estimated_files: 1
skills_used: []
---

# T03: Bypass getUserLimits with hardcoded max-limits object

Why: R002 requires getUserLimits() to return maximum values for all limits without making an API call. Removes all caps on builds, projects, AI tokens, etc. Must return a valid Limits Flow type.

Do:
1. Edit getUserLimits() in Usage.js (line 445) to return a hardcoded Limits object instead of making an API call
2. The hardcoded object must match the Flow exact type:
   - quotas: {} (empty dict — consumers use optional chaining)
   - capabilities: all fields enabled with max values
     * analytics: {sessions:true, players:true, retention:true, sessionsTimeStats:true, platforms:true}
     * cloudProjects: {maximumCount:999, canMaximumCountBeIncreased:true, maximumGuestCollaboratorsPerProject:99}
     * leaderboards: {maximumCountPerGame:999, canMaximumCountPerGameBeIncreased:true, themeCustomizationCapabilities:'FULL', canUseCustomCss:true, canDisableLoginInLeaderboard:true}
     * multiplayer: {lobbiesCount:999, maxPlayersPerLobby:99, themeCustomizationCapabilities:'FULL'}
     * versionHistory: {enabled:true, retentionDays:365}
     * ai: {availablePresets: []}
   - credits: {userBalance:{amount:999999}, prices:{}, purchasableQuantities:{}}
   - message: undefined
3. Make the function sync (remove async keyword) — no API call needed
4. The getAuthorizationHeader and userId params stay in signature to avoid breaking callers
5. Run npm test to verify existing tests still pass

Done when: getUserLimits returns max Limits object synchronously with no API call.

## Inputs

- `newIDE/app/src/Utils/GDevelopServices/Usage.js`

## Expected Output

- `newIDE/app/src/Utils/GDevelopServices/Usage.js`

## Verification

grep -q "maximumCount: 999" newIDE/app/src/Utils/GDevelopServices/Usage.js
