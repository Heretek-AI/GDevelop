# S02: IPC Infrastructure

**Goal:** window.byokAi available in renderer, IPC handlers registered in main process
**Demo:** window.byokAi available in renderer, IPC handlers registered in main process

## Must-Haves

- All proxy modules load without syntax errors. node --test passes for all test-t0X.cjs files. main.js has preload path, byok require, and registerByokHandlers call.

## Proof Level

- This slice proves: Integration complete: preload bridge → IPC handler → LLM call works end-to-end in a running Electron instance

## Integration Closure

main.js has all three edits applied, preload.js is syntactically valid, byokMain.js loads and exports registerByokHandlers, all proxy modules load without errors

## Verification

- Structured ByokError with typed codes, requestStore provides active request tracking via IPC

## Tasks

- [x] **T01: Create errors.js and buildSystemPrompt.js modules with tests** `est:15m`
  Create the byok/ directory at newIDE/electron-app/app/byok/. Create errors.js exporting a ByokError class extending Error with a static codes object. Create buildSystemPrompt.js exporting a buildSystemPrompt function accepting {context, language} options and returning an assembled prompt string. Create test-t01.cjs using node:assert and node:test to verify: (1) ByokError is an instance of Error, (2) ByokError stores code and message correctly, (3) All error codes exist with expected values, (4) buildSystemPrompt returns a string, (5) buildSystemPrompt includes context when provided.
  - Files: `newIDE/electron-app/app/byok/errors.js`, `newIDE/electron-app/app/byok/buildSystemPrompt.js`, `newIDE/electron-app/app/byok/test-t01.cjs`
  - Verify: node --test newIDE/electron-app/app/byok/test-t01.cjs

- [x] **T02: Create byokConfig.js and requestStore.js modules with tests** `est:20m`
  Create byokConfig.js exporting readConfig(), writeConfig(config), getConfigPath(). readConfig returns parsed JSON or empty object on ENOENT. writeConfig writes JSON with 2-space indent. Uses fs-extra (already in package.json deps) and requires('electron') for app.getPath. byokConfig.js cannot be unit-tested outside Electron, so only syntax-verify it.
  - Files: `newIDE/electron-app/app/byok/byokConfig.js`, `newIDE/electron-app/app/byok/requestStore.js`, `newIDE/electron-app/app/byok/test-t02.cjs`
  - Verify: node --test newIDE/electron-app/app/byok/test-t02.cjs

- [x] **T03: Create callLLM.js — core OpenAI-compatible LLM caller** `est:30m`
  Create callLLM.js exporting callLLM({messages, requestId, signal}) and callLLMStream({messages, onChunk, requestId, signal}).
  - Files: `newIDE/electron-app/app/byok/callLLM.js`, `newIDE/electron-app/app/byok/test-t03.cjs`
  - Verify: node --test newIDE/electron-app/app/byok/test-t03.cjs

- [x] **T04: Create preload.js, byokMain.js, and edit main.js for IPC wiring** `est:30m`
  Create preload.js exposing window.byokAi via contextBridge with {callLLM, getConfig, saveConfig, getActiveRequests, abortRequest}.
  - Files: `newIDE/electron-app/app/preload.js`, `newIDE/electron-app/app/byok/byokMain.js`, `newIDE/electron-app/app/main.js`, `newIDE/electron-app/app/byok/test-t04.cjs`
  - Verify: node --test newIDE/electron-app/app/byok/test-t04.cjs

- [x] **T05: Verify IPC round-trip works end-to-end** `est:15m`
  Launch the Electron app and verify that window.byokAi is available in the renderer DevTools console. Test IPC round-trip by calling window.byokAi.getConfig() and verifying it returns an empty config (no crash). Verify that window.byokAi has all 5 expected methods: callLLM, getConfig, saveConfig, getActiveRequests, abortRequest.
  - Files: `newIDE/electron-app/app/main.js`, `newIDE/electron-app/app/preload.js`, `newIDE/electron-app/app/byok/byokMain.js`
  - Verify: Launch Electron app, check window.byokAi in DevTools

## Files Likely Touched

- newIDE/electron-app/app/byok/errors.js
- newIDE/electron-app/app/byok/buildSystemPrompt.js
- newIDE/electron-app/app/byok/test-t01.cjs
- newIDE/electron-app/app/byok/byokConfig.js
- newIDE/electron-app/app/byok/requestStore.js
- newIDE/electron-app/app/byok/test-t02.cjs
- newIDE/electron-app/app/byok/callLLM.js
- newIDE/electron-app/app/byok/test-t03.cjs
- newIDE/electron-app/app/preload.js
- newIDE/electron-app/app/byok/byokMain.js
- newIDE/electron-app/app/main.js
- newIDE/electron-app/app/byok/test-t04.cjs
