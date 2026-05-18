# S02 — IPC Infrastructure — Research

**Date:** 2026-05-18

## Summary

S02 establishes the Electron IPC bridge and main-process proxy modules that enable BYOK AI routing. The architecture routes AI requests through `ipcRenderer.invoke()` / `ipcMain.handle()` with a preload script exposing `window.byokAi` via `contextBridge`. Five proxy modules handle LLM calling, error handling, config persistence, request tracking, and system prompt assembly.

The existing app already uses `ipcRenderer.invoke()` pattern. The main.js file has well-defined insertion points. No new npm dependencies needed — Node built-in `https`/`http` modules suffice for LLM API calls (Electron 32.3.3 with Node 22.x has native `fetch` available).

**Requirements served:** R006 (preload + IPC registration), R007 (5 proxy modules).

## Recommendation

Build in two phases:

**T01 (higher risk):** Create 5 proxy modules in `newIDE/electron-app/app/byok/`:
- `callLLM.js` — Makes OpenAI-compatible API calls via Node `https`/`fetch`
- `errors.js` — Structured `ByokError` with codes (INVALID_KEY, ENDPOINT_UNREACHABLE, MODEL_NOT_FOUND, RATE_LIMITED, UNKNOWN)
- `byokConfig.js` — Read/write config JSON at `app.getPath('userData')/byok-config.json`
- `requestStore.js` — In-memory request tracking (AbortController management, streaming state)
- `buildSystemPrompt.js` — Assemble system prompt for AI requests

**T02 (straightforward):** Wire it all together:
- Create `preload.js` exposing `window.byokAi` via `contextBridge`
- Edit `main.js`: add preload script path in BrowserWindow `webPreferences`, register IPC handlers in `app.on('ready')`

## Implementation Landscape

### Key Files

- **`newIDE/electron-app/app/main.js`** (832 lines) — Three insertion points:
  - Top (lines 1-30): module requires — add `require('./byok/...')`
  - ~Line 155: BrowserWindow `webPreferences` — add `preload: path.join(__dirname, 'preload.js')`
  - ~Line 380 (inside `app.on('ready')`): register IPC handlers via `ipcMain.handle()`
- **`newIDE/electron-app/app/package.json`** — Has `axios` and `fs-extra` available (no new deps needed for BYOK)
- **`newIDE/electron-app/app/preload.js`** — DOES NOT EXIST YET. Must create. Uses `contextBridge.exposeInMainWorld('byokAi', { ... })`
- **`newIDE/electron-app/app/byok/`** — New directory for 5 proxy modules (DOES NOT EXIST YET)

### Existing IPC Pattern

The renderer already uses:
```js
optionalRequire('electron') && 
  optionalRequire('electron').ipcRenderer.invoke('command', args)
```

Main process registers:
```js
ipcMain.handle('command', async (event, args) => { ... })
```

For progress/callbacks, the pattern is `ipcMain.on()` + `event.sender.send()`.

### Build Order (T01 first, then T02)

**T01 — Proxy Modules (do first, higher risk):**
1. `byok/errors.js` — ByokError class with typed error codes
2. `byok/byokConfig.js` — JSON file read/write (fs-extra), path from `app.getPath('userData')`
3. `byok/requestStore.js` — Map of requestId → { abortController, status, startTime }
4. `byok/buildSystemPrompt.js` — System prompt assembly function
5. `byok/callLLM.js` — Core LLM caller with 30s/60s timeout, streaming support

**T02 — Wiring (lower risk):**
6. `preload.js` — contextBridge.exposeInMainWorld('byokAi', { callLLM, getConfig, ... })
7. `main.js` edits — preload path + IPC handler registration

### Verification Approach

1. `node -e "require('./byok/byokConfig')"` — verify module loads without errors
2. `node -e "require('./preload')"` — verify preload script syntax
3. Launch Electron app, check DevTools console for `window.byokAi` availability
4. Manual: `window.byokAi.callLLM({...})` in DevTools to verify IPC round-trip

## Constraints

- No new npm dependencies (use Node built-in `https`/`http`/`fetch` for LLM calls)
- Electron 32.3.3 (Node 22.x) — `fetch` available natively
- `contextIsolation: false` in BrowserWindow config — `contextBridge` still works alongside it
- CommonJS `module.exports` pattern for all modules (no ES modules in main process)

## Common Pitfalls

- **axios dependency risk** — Some existing modules use `require('axios')` but it relies on hoisting. BYOK modules must use Node built-ins to be safe.
- **preload script path** — Must use `path.join(__dirname, 'preload.js')` not a relative string — Electron resolves preload paths from app root.
- **contextBridge vs nodeIntegration** — With `contextIsolation: false`, `contextBridge` still works but the API surface is cleaner. Keep existing IPC fallback paths unmodified for safety.
- **AbortController for streaming** — LLM streaming requests may need cancellation. Use `AbortController` tracked in `requestStore.js`.

## Open Risks

- **Node built-in HTTP streaming** — The `https` module's streaming API is more verbose than `axios`. If native `fetch` (available in Electron 32) is used, streaming requires `Response.body.getReader()`.

## Skills Discovered

No new skills needed. The technologies (Electron IPC, Node.js, CommonJS modules) are standard and already understood.
