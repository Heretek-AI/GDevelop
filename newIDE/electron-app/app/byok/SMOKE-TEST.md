# BYOK Smoke-Test Procedure

This document is the manual verification checklist for the BYOK (Bring Your Own Key)
feature in the GDevelop Electron desktop app.  Each step exercises a specific code
path and includes the expected result and troubleshooting notes.

**Last updated:** 2026-05-19
**Target:** GDevelop Electron desktop app (built from `newIDE/electron-app`)
**Feature slice:** M001/S05 — Integration & Regression

---

## 1. Prerequisites

| Requirement | Minimum Version | Check Command |
|---|---|---|
| Node.js | 18 LTS | `node --version` |
| npm | 9+ | `npm --version` |
| Git | any recent | `git --version` |

- A valid API key for at least one supported provider (OpenAI, Anthropic, Google,
  Groq, Mistral, or DeepSeek).  OpenAI (`https://api.openai.com/v1/chat/completions`)
  is the default and is assumed throughout this document.
- The GDevelop Electron app source checked out at the `M001/S05` integration
  branch or equivalent.

> ⚠️  **Important:** BYOK is an Electron-only feature.  The web build (`newIDE/app`)
> will show a "BYOK configuration is only available in the desktop app" message
> in place of the config panel.  All smoke tests must be run inside the Electron
> desktop app.

---

## 2. Setup

```bash
# From the repository root:
cd newIDE/electron-app

# Install dependencies (only needed once)
npm install

# Start the Electron app in development mode
npm start
```

The app window should open within 30 seconds.  Leave the DevTools console open
(**View → Toggle Developer Tools**) so you can observe `[byok…]` and
`[ByokRouting]` console logs during the tests.

---

## 3. Test Cases

The following 17 test steps cover all 8 milestone success criteria (a–h).

---

### Step 1 — App launches without errors (criterion a)

| | |
|---|---|
| **Action** | Start the app with `npm start` from `newIDE/electron-app`. |
| **Check** | The main window appears.  The DevTools console (View → Toggle Developer Tools) contains no red error messages. |
| **Expected** | No `Uncaught Error`, `TypeError`, or `ReferenceError` in the console.  The splash screen resolves to the GDevelop editor normally. |

---

### Step 2 — Main-process BYOK handlers registered (criterion a)

| | |
|---|---|
| **Action** | In the DevTools console, look for the line range where `registerByokHandlers` runs during app startup.  You can also open the main process console (if available) or check that the preload bridge is initialised. |
| **Check** | The BYOK IPC bridge is available.  Open the renderer DevTools Console and type: `window.byokAi` |
| **Expected** | `window.byokAi` returns an object with methods: `getConfig`, `saveConfig`, `callLLM`, `callLLMStream`, `getActiveRequests`, `abortRequest`.  Not `undefined`. |

---

### Step 3 — No subscription gate or upsell visible (criterion b)

| | |
|---|---|
| **Action** | Open any project.  Open the AI chat panel (click the AI icon in the toolbar or **View → AI Assistant**). |
| **Check** | No full-screen subscription upsell, no "Upgrade your plan" banner, and no lock icon blocking the AI chat input. |
| **Expected** | The chat input field is interactive and shows a placeholder like "Ask the AI assistant…".  You can type a message without being redirected to a pricing page. |

---

### Step 4 — No 'Made with GDevelop' watermark on preview (criterion c)

| | |
|---|---|
| **Action** | Open any project with at least one scene.  Click the **Preview** button (▶) in the toolbar. |
| **Check** | The preview window launches and shows the game.  Look for a "Made with GDevelop" watermark overlay. |
| **Expected** | No watermark text or logo is displayed over the game preview.  The game renders cleanly. |

---

### Step 5 — BYOK preset visible in AI config dropdown — Chat mode (criterion d)

| | |
|---|---|
| **Action** | Open a project.  Open the AI chat panel.  Click the AI configuration dropdown (the preset selector, typically at the top of the AI panel). |
| **Check** | Scroll through the list of available AI presets. |
| **Expected** | A preset named **"BYOK (Bring Your Own Key)"** is listed.  Select it.  The preset is selected and the dropdown label changes to "BYOK (Bring Your Own Key)". |

---

### Step 6 — BYOK preset visible — Agent mode (criterion d)

| | |
|---|---|
| **Action** | Switch the AI mode to **Agent** (if switching modes is available in your build; otherwise open a new AI agent panel).  Open the preset dropdown. |
| **Check** | The "BYOK (Bring Your Own Key)" preset is listed. |
| **Expected** | BYOK preset is available and selectable in Agent mode. |

---

### Step 7 — BYOK preset visible — Orchestrator mode (criterion d)

| | |
|---|---|
| **Action** | Switch the AI mode to **Orchestrator**.  Open the preset dropdown. |
| **Check** | The "BYOK (Bring Your Own Key)" preset is listed. |
| **Expected** | BYOK preset is available and selectable in all three modes (Chat, Agent, Orchestrator). |

---

### Step 8 — Config panel renders when BYOK preset is selected (criterion e)

| | |
|---|---|
| **Action** | With the BYOK preset selected in the AI chat panel, look for the BYOK configuration form below (or to the side of) the preset dropdown. |
| **Check** | The config panel shows: a **Provider** dropdown (OpenAI, Anthropic, Google, Groq, Mistral, DeepSeek), an **Endpoint URL** text field, an **API Key** text field, a **Model** text field, and a **Save** button. |
| **Expected** | All four fields are visible and interactive.  The Provider dropdown defaults to "OpenAI".  The endpoint field may be pre-filled with `https://api.openai.com/v1/chat/completions` if previously saved. |

---

### Step 9 — Config panel hidden when non-BYOK preset selected (criterion e)

| | |
|---|---|
| **Action** | Switch the preset dropdown back to a non-BYOK preset (e.g. the default GDevelop AI preset). |
| **Check** | The BYOK configuration panel disappears. |
| **Expected** | Provider, endpoint, API key, and model fields are no longer visible.  The chat input returns to its normal appearance. |

---

### Step 10 — Save config (criterion f)

| | |
|---|---|
| **Action** | Switch back to the BYOK preset.  Fill in the fields: select **OpenAI** as provider, enter `https://api.openai.com/v1/chat/completions` for the endpoint, paste a valid OpenAI API key into the API Key field, enter `gpt-4o-mini` for the model, and click **Save**. |
| **Check** | A green "Configuration saved." message appears next to the Save button.  The API Key field is replaced by "✅ Key saved".  The DevTools console shows `[ByokConfigPanel] Config saved successfully`. |
| **Expected** | Config saves without error.  The feedback message is green. |

---

### Step 11 — Config persists across app restart (criterion f)

| | |
|---|---|
| **Action** | Close the Electron app completely (**File → Quit** or Cmd+Q / Alt+F4).  Re-launch with `npm start`.  Re-open a project, open the AI chat panel, select the BYOK preset. |
| **Check** | The config panel shows "✅ Key saved" (the API key was persisted from the previous session).  The provider and model fields reflect the values you saved in Step 10.  The DevTools console shows `[ByokConfigPanel] Config loaded successfully` with the saved provider and model. |
| **Expected** | Previously saved configuration is restored.  The API key is masked (the renderer never receives the raw key — it only knows whether a key exists via `hasApiKey`). |

---

### Step 12 — Chat request with BYOK preset calls configured LLM (criterion g)

| | |
|---|---|
| **Action** | With the BYOK preset selected and config saved, type a simple prompt into the AI chat input — e.g. "Say hello and tell me what model you are."  Press Enter/Send. |
| **Check** | The chat shows a loading/spinner state.  Within a few seconds, an assistant response appears.  The DevTools console shows: `[ByokRouting] Creating BYOK AI request` followed by `[ByokRouting] BYOK request completed successfully` with the request ID and mode. |
| **Expected** | The LLM responds with a message.  The response is displayed in the chat as an assistant bubble (just like a normal GDevelop AI response).  No error message is shown. |

---

### Step 13 — Chat request with non-BYOK preset works normally (criterion h)

| | |
|---|---|
| **Action** | Switch the AI preset to a non-BYOK preset (e.g. the default preset).  Type a prompt: "What is 2+2?" and press Enter/Send. |
| **Check** | The chat shows a loading state, then an assistant response appears.  The DevTools console does **not** show `[ByokRouting]` messages — the request is routed through the normal GDevelop API path. |
| **Expected** | The standard GDevelop AI chat functions correctly alongside the BYOK path.  Both presets can be used interchangeably without affecting each other. |

---

### Step 14 — Streaming response (criterion g)

| | |
|---|---|
| **Action** | Switch back to the BYOK preset.  Type a prompt that will generate a longer response — e.g. "Write a short paragraph about game development."  Observe the response as it appears. |
| **Check** | If streaming is implemented in the UI, the response should appear incrementally (word-by-word) rather than all at once.  The DevTools console shows the streaming IPC events. |
| **Expected** | Streaming mode delivers chunks progressively (if the UI supports `callLLMStream`).  The final response is complete and coherent. |

---

### Step 15 — BYOK error handling — invalid API key (criterion g)

| | |
|---|---|
| **Action** | Clear the saved key: re-enter the BYOK config panel, type an obviously invalid key (e.g. `sk-not-a-real-key`), and click Save.  Send a chat message. |
| **Check** | The chat displays an error message.  The DevTools console shows `[ByokRouting] BYOK request failed` with the error details. |
| **Expected** | A user-facing error is shown (not a crash or blank screen).  The error code and message are logged for debugging.  The app remains responsive — you can correct the key and try again. |

---

### Step 16 — BYOK error handling — unreachable endpoint (criterion g)

| | |
|---|---|
| **Action** | Change the endpoint to a non-existent URL (e.g. `https://localhost:19999/v1/chat/completions`) and click Save.  Send a chat message. |
| **Check** | After the connection timeout (~30 seconds), an error message appears.  The DevTools console shows `[ByokRouting] BYOK request failed` with an endpoint-unreachable error. |
| **Expected** | The app handles the network failure gracefully — it does not freeze, crash, or hang indefinitely.  The error is displayed to the user. |

---

### Step 17 — Switch back to BYOK preset after using non-BYOK (criteria g + h)

| | |
|---|---|
| **Action** | Send a message with the non-BYOK preset (Step 13), then switch to the BYOK preset and send another message (Step 12), then switch back to the non-BYOK preset and send a third message. |
| **Check** | All three messages receive responses.  The preset switch does not cause any state corruption, double-send, or stuck loading states. |
| **Expected** | BYOK and non-BYOK presets can be used interchangeably within the same session without issues.  Each request is routed to the correct backend. |

---

## 4. Expected Results Summary

| Criterion | Description | Steps |
|---|---|---|
| **(a)** | App launches without errors with BYOK changes | 1, 2 |
| **(b)** | No subscription gate or upsell visible | 3 |
| **(c)** | No 'Made with GDevelop' watermark on preview | 4 |
| **(d)** | BYOK preset visible in AI config dropdown for all 3 modes | 5, 6, 7 |
| **(e)** | Config panel renders with provider/endpoint/key/model fields when BYOK selected | 8, 9 |
| **(f)** | Saving config persists across restart | 10, 11 |
| **(g)** | Chat request with BYOK preset calls configured LLM and returns response | 12, 14, 15, 16, 17 |
| **(h)** | Chat request with non-BYOK preset works normally through GDevelop API | 13, 17 |

---

## 5. Troubleshooting

### App crashes on startup with `Cannot find module './byok/byokMain'`

The BYOK module directory may be missing or the branch may not include the
BYOK files.  Verify that `newIDE/electron-app/app/byok/` exists and contains
all 7 main-process source files:

```
byok/
  errors.js
  buildSystemPrompt.js
  byokConfig.js
  requestStore.js
  callLLM.js
  byokMain.js
  SMOKE-TEST.md  ← this file
```

### `window.byokAi` is `undefined`

The preload script may not be loading correctly.  Check that:

- `newIDE/electron-app/app/preload.js` contains the `contextBridge.exposeInMainWorld('byokAi', { … })` block (line 13).
- The `webPreferences.preload` in `main.js` points to the preload script.
- The app was started with `npm start` (not served from a web server).

### "BYOK configuration is only available in the desktop app" message

You are running the web build, not the Electron desktop app.  Use `npm start`
from `newIDE/electron-app/` to launch the desktop app.

### "No API key configured" error when sending a chat

The BYOK config was not saved, or the API key field was left empty.  Re-enter
the config panel, paste a valid API key, and click Save.  Verify that
"✅ Key saved" appears next to the Save button.

### 401 / 403 error from the LLM provider

The API key is invalid or has been revoked.  Generate a new key from your
provider's dashboard and update it in the BYOK config panel.

### 404 error — "model not found"

The model name is incorrect or not available at the configured endpoint.
Verify the model name with your provider's documentation and correct it in
the BYOK config panel.

### Request times out with no response

- Verify your network connection.
- Check that the endpoint URL is correct and reachable (try `curl` from a
  terminal).
- If using a custom endpoint (e.g. local Ollama), ensure the server is running
  and listening on the configured port.

### Chat response appears but content is blank or garbled

The provider's response format may differ from the expected OpenAI-compatible
shape.  BYOK currently expects OpenAI-compatible chat completion responses.
Non-OpenAI-compatible endpoints may not work correctly.

### Config not persisting after restart

Check that the Electron `userData` directory is writable.  The config file is
stored at `<userData>/byok-config.json`.  On Windows this is typically
`%APPDATA%/GDevelop/byok-config.json`.  On macOS it is
`~/Library/Application Support/GDevelop/byok-config.json`.

Look for warning messages containing `[byokConfig]` in the main process console.

---

## 6. Verification Log Template

Copy this section and fill it in each time you run the smoke test.

```
────────────────────────────────────────────────────────────
 BYOK SMOKE TEST — VERIFICATION LOG
────────────────────────────────────────────────────────────

 Date:       YYYY-MM-DD
 Tester:     ____________________
 App version / commit: ____________________
 Platform:   [ ] Windows   [ ] macOS   [ ] Linux
 Provider:   [ ] OpenAI   [ ] Anthropic   [ ] Google   [ ] Other: ______

────────────────────────────────────────────────────────────
 STEP RESULTS
────────────────────────────────────────────────────────────

 [ ] Step  1 — App launches without errors                      (criterion a)
        Notes: __________________________________________________

 [ ] Step  2 — window.byokAi bridge available                    (criterion a)
        Notes: __________________________________________________

 [ ] Step  3 — No subscription gate or upsell                    (criterion b)
        Notes: __________________________________________________

 [ ] Step  4 — No watermark on preview                           (criterion c)
        Notes: __________________________________________________

 [ ] Step  5 — BYOK preset in Chat mode dropdown                 (criterion d)
        Notes: __________________________________________________

 [ ] Step  6 — BYOK preset in Agent mode dropdown                (criterion d)
        Notes: __________________________________________________

 [ ] Step  7 — BYOK preset in Orchestrator mode dropdown         (criterion d)
        Notes: __________________________________________________

 [ ] Step  8 — Config panel visible with all 4 fields            (criterion e)
        Notes: __________________________________________________

 [ ] Step  9 — Config panel hidden for non-BYOK preset           (criterion e)
        Notes: __________________________________________________

 [ ] Step 10 — Save config with green confirmation               (criterion f)
        Notes: __________________________________________________

 [ ] Step 11 — Config persists across app restart                (criterion f)
        Notes: __________________________________________________

 [ ] Step 12 — Chat request with BYOK returns LLM response       (criterion g)
        Notes: __________________________________________________

 [ ] Step 13 — Chat request with non-BYOK works normally         (criterion h)
        Notes: __________________________________________________

 [ ] Step 14 — Streaming response works                          (criterion g)
        Notes: __________________________________________________

 [ ] Step 15 — Invalid API key shows user-facing error           (criterion g)
        Notes: __________________________________________________

 [ ] Step 16 — Unreachable endpoint handled gracefully           (criterion g)
        Notes: __________________________________________________

 [ ] Step 17 — Preset switching preserves state                  (criteria g+h)
        Notes: __________________________________________________

────────────────────────────────────────────────────────────
 SUMMARY
────────────────────────────────────────────────────────────

 Passed:  ____ / 17
 Failed:  ____ / 17
 Skipped: ____ / 17

 All 8 milestone success criteria met: [ ] YES   [ ] NO

 Issues found (attach screenshots or console logs):
 ____________________________________________________________
 ____________________________________________________________
 ____________________________________________________________

────────────────────────────────────────────────────────────
 SIGN-OFF
────────────────────────────────────────────────────────────

 Tester signature: ____________________  Date: ______________

 Reviewer signature: ____________________  Date: ______________
```
