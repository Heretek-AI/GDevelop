# S02: IPC Infrastructure

**Goal:** Establish the Electron IPC bridge and main-process BYOK proxy modules that enable AI routing through user-owned LLM keys. After this slice, window.byokAi is available in the renderer via contextBridge and all IPC handlers are registered in the main process.
**Demo:** window.byokAi available in renderer, IPC handlers registered in main process

## Must-Haves

- All 5 proxy modules (errors.js, byokConfig.js, requestStore.js, buildSystemPrompt.js, callLLM.js) pass node --check. byokMain.js and preload.js pass node --check. main.js has preload path in webPreferences and registerByokHandlers(ipcMain) called inside app.on('ready'). Unit tests for pure JS modules pass with node --test.

## Proof Level

- This slice proves: contract

## Integration Closure

This slice wires 5 new modules into the Electron main process via byokMain.js and preload.js. Upstream surfaces consumed: main.js (preload path in webPreferences, IPC handler registration inside app.on('ready')). Downstream: S03 (AI Routing) will consume window.byokAi from the renderer side. S04 (Config UI) and S05 (Integration) depend on the IPC channels established here.

## Verification

- byokMain.js registers structured IPC channels with error forwarding to the renderer. requestStore.js exposes getRequestStatus() for inspecting in-flight requests. All errors are typed ByokError instances serializable over IPC via toJSON().

## Tasks

- [ ] **T01: Create errors.js and buildSystemPrompt.js modules** `est:20m`
  Why: errors.js provides structured error handling for all BYOK modules (typed error codes: INVALID_KEY, ENDPOINT_UNREACHABLE, MODEL_NOT_FOUND, RATE_LIMITED, UNKNOWN). buildSystemPrompt.js assembles the system prompt for AI requests — both are foundational pure-JS modules with no Electron dependency.
  - Files: `newIDE/electron-app/app/byok/errors.js`, `newIDE/electron-app/app/byok/buildSystemPrompt.js`
  - Verify: node --check newIDE/electron-app/app/byok/errors.js && node --check newIDE/electron-app/app/byok/buildSystemPrompt.js

- [ ] **T02: Create byokConfig.js and requestStore.js modules** `est:25m`
  Why: byokConfig.js persists BYOK configuration (provider, endpoint, key, model) to a JSON file at app.getPath('userData')/byok-config.json using fs-extra (already a dependency). requestStore.js manages in-flight AI requests with AbortController tracking for cancellation support.
  - Files: `newIDE/electron-app/app/byok/byokConfig.js`, `newIDE/electron-app/app/byok/requestStore.js`
  - Verify: node --check newIDE/electron-app/app/byok/requestStore.js && node --check newIDE/electron-app/app/byok/byokConfig.js

- [ ] **T03: Create callLLM.js core module** `est:30m`
  Why: callLLM.js is the core LLM API caller that translates IPC requests into OpenAI-compatible HTTP API calls. Uses native fetch (available in Electron 32 / Node 22) rather than axios to avoid dependency hoisting issues. Supports both streaming and non-streaming modes with configurable timeouts.
  - Files: `newIDE/electron-app/app/byok/callLLM.js`
  - Verify: node --check newIDE/electron-app/app/byok/callLLM.js

- [ ] **T04: Create byokMain.js and preload.js, wire into main.js** `est:30m`
  Why: byokMain.js is the centralized IPC handler registration module that imports all 5 BYOK modules and registers IPC handlers. preload.js exposes window.byokAi via contextBridge. main.js needs 3 surgical edits to wire everything together.
  - Files: `newIDE/electron-app/app/byok/byokMain.js`, `newIDE/electron-app/app/preload.js`, `newIDE/electron-app/app/main.js`
  - Verify: node --check newIDE/electron-app/app/byok/byokMain.js && node --check newIDE/electron-app/app/preload.js

- [ ] **T05: Write and run unit tests for pure JS modules** `est:25m`
  Why: errors.js, buildSystemPrompt.js, requestStore.js, and callLLM.js are pure JavaScript with no Electron dependency and can be unit tested using Node 22's built-in node:test runner. Tests provide regression protection for downstream slices.
  - Files: `newIDE/electron-app/app/byok/tests/errors.test.js`, `newIDE/electron-app/app/byok/tests/buildSystemPrompt.test.js`, `newIDE/electron-app/app/byok/tests/requestStore.test.js`, `newIDE/electron-app/app/byok/tests/callLLM.test.js`
  - Verify: node --test newIDE/electron-app/app/byok/tests/

## Files Likely Touched

- newIDE/electron-app/app/byok/errors.js
- newIDE/electron-app/app/byok/buildSystemPrompt.js
- newIDE/electron-app/app/byok/byokConfig.js
- newIDE/electron-app/app/byok/requestStore.js
- newIDE/electron-app/app/byok/callLLM.js
- newIDE/electron-app/app/byok/byokMain.js
- newIDE/electron-app/app/preload.js
- newIDE/electron-app/app/main.js
- newIDE/electron-app/app/byok/tests/errors.test.js
- newIDE/electron-app/app/byok/tests/buildSystemPrompt.test.js
- newIDE/electron-app/app/byok/tests/requestStore.test.js
- newIDE/electron-app/app/byok/tests/callLLM.test.js
