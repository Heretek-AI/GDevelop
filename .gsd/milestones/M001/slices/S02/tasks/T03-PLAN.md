---
estimated_steps: 10
estimated_files: 1
skills_used: []
---

# T03: Create callLLM.js core module

Why: callLLM.js is the core LLM API caller that translates IPC requests into OpenAI-compatible HTTP API calls. Uses native fetch (available in Electron 32 / Node 22) rather than axios to avoid dependency hoisting issues. Supports both streaming and non-streaming modes with configurable timeouts.

Do:
1. Create byok/callLLM.js exporting async function callLLM({ provider, endpoint, apiKey, model, messages, stream, signal })
2. Validate inputs using errors.js error types
3. Build OpenAI-compatible request body from messages array
4. Use fetch() with AbortSignal from requestStore for cancellation
5. Set 30s connection timeout, 60s streaming timeout
6. For streaming: use Response.body.getReader() to read chunks, yield parsed delta content
7. For non-streaming: return full response content
8. Handle HTTP errors, network failures, timeouts — all mapped to ByokError types

## Inputs

- `newIDE/electron-app/app/byok/errors.js`
- `newIDE/electron-app/app/byok/requestStore.js`

## Expected Output

- `newIDE/electron-app/app/byok/callLLM.js`

## Verification

node --check newIDE/electron-app/app/byok/callLLM.js
