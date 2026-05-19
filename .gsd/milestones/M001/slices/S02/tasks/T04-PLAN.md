---
estimated_steps: 13
estimated_files: 3
skills_used: []
---

# T04: Create byokMain.js and preload.js, wire into main.js

Why: byokMain.js is the centralized IPC handler registration module that imports all 5 BYOK modules and registers IPC handlers. preload.js exposes window.byokAi via contextBridge. main.js needs 3 surgical edits to wire everything together.

Do:
1. Create byok/byokMain.js exporting registerByokHandlers(ipcMain) function that registers these IPC handlers:
   - 'byok-call-llm' (ipcMain.handle) — calls callLLM, returns result
   - 'byok-get-config' (ipcMain.handle) — returns current config from byokConfig
   - 'byok-save-config' (ipcMain.handle) — persists config via byokConfig
   - 'byok-abort-request' (ipcMain.handle) — aborts a request via requestStore
   - 'byok-get-request-status' (ipcMain.handle) — returns request tracking state
2. Create preload.js using contextBridge.exposeInMainWorld('byokAi', { callLLM, getConfig, saveConfig, abortRequest, getRequestStatus }) — each method calls ipcRenderer.invoke()
3. Edit main.js at 3 points:
   a) After requires block (around line 30): add const { registerByokHandlers } = require('./byok/byokMain');
   b) Line ~157 (inside webPreferences): add preload: path.join(__dirname, 'preload.js'),
   c) Inside app.on('ready') handler, before 'set-main-menu' handler at ~line 392: add registerByokHandlers(ipcMain);

## Inputs

- `newIDE/electron-app/app/byok/errors.js`
- `newIDE/electron-app/app/byok/byokConfig.js`
- `newIDE/electron-app/app/byok/requestStore.js`
- `newIDE/electron-app/app/byok/buildSystemPrompt.js`
- `newIDE/electron-app/app/byok/callLLM.js`
- `newIDE/electron-app/app/main.js`

## Expected Output

- `newIDE/electron-app/app/byok/byokMain.js`
- `newIDE/electron-app/app/preload.js`

## Verification

node --check newIDE/electron-app/app/byok/byokMain.js && node --check newIDE/electron-app/app/preload.js
