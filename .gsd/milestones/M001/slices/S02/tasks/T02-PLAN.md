---
estimated_steps: 5
estimated_files: 2
skills_used: []
---

# T02: Create byokConfig.js and requestStore.js modules

Why: byokConfig.js persists BYOK configuration (provider, endpoint, key, model) to a JSON file at app.getPath('userData')/byok-config.json using fs-extra (already a dependency). requestStore.js manages in-flight AI requests with AbortController tracking for cancellation support.

Do:
1. Create byok/byokConfig.js: export getConfig() and saveConfig(config) that read/write JSON from app.getPath('userData')/byok-config.json using fs-extra. Handle missing file gracefully (return defaults).
2. Create byok/requestStore.js: export createRequest(requestId), getRequest(requestId), abortRequest(requestId), cleanupRequest(requestId), and getAllRequests(). Use a module-level Map. Each entry: { abortController, status: 'pending'|'streaming'|'completed'|'aborted'|'errored', startTime, error: null }.

CommonJS module.exports throughout.

## Inputs

- `newIDE/electron-app/app/byok/errors.js`

## Expected Output

- `newIDE/electron-app/app/byok/byokConfig.js`
- `newIDE/electron-app/app/byok/requestStore.js`

## Verification

node --check newIDE/electron-app/app/byok/requestStore.js && node --check newIDE/electron-app/app/byok/byokConfig.js
