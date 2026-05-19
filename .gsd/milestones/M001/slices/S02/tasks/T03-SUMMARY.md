---
id: T03
parent: S02
milestone: M001
key_files:
  - newIDE/electron-app/app/byok/callLLM.js
  - newIDE/electron-app/app/byok/test-t03.cjs
key_decisions:
  - callLLM uses native fetch (available in Electron 32/Node 22) rather than axios to avoid dependency hoisting issues
  - SSE parsing in parseSSEChunk silently skips malformed JSON lines — common with providers that emit partial chunks or empty data lines
  - withTimeout helper merges external AbortSignal with a configurable timeout signal, cleaning up both timer and listener on abort
  - Non-streaming uses 30s connection timeout; streaming uses 60s to allow for slow model generation
  - byokConfig mocked via mock.method for tests since it requires Electron's app.getPath('userData'); electron module mocked via Module._resolveFilename patch
duration: 
verification_result: passed
completed_at: 2026-05-19T01:58:02.693Z
blocker_discovered: false
---

# T03: Created callLLM.js with callLLM and callLLMStream — OpenAI-compatible fetch-based LLM caller with typed error mapping, SSE streaming, request tracking, and configurable timeouts

**Created callLLM.js with callLLM and callLLMStream — OpenAI-compatible fetch-based LLM caller with typed error mapping, SSE streaming, request tracking, and configurable timeouts**

## What Happened

Implemented callLLM.js exporting two functions: callLLM (non-streaming) and callLLMStream (streaming SSE). Both: (1) read config via readConfig() from byokConfig.js, (2) validate inputs with ByokError, (3) prepend system prompt via buildSystemPrompt, (4) register with requestStore when requestId provided, (5) build an OpenAI-compatible request body, (6) call fetch() with AbortSignal merging (external + 30s/60s timeout), (7) map HTTP status codes to typed ByokError codes (401→INVALID_KEY, 404→MODEL_NOT_FOUND, 429→RATE_LIMITED, others→UNKNOWN), (8) map network failures (TypeError, AbortError) to ENDPOINT_UNREACHABLE. For streaming, Response.body.getReader() is used to parse SSE chunks, calling onChunk for each delta and returning accumulated text. The parseSSEChunk helper handles multi-line chunks, [DONE] termination, and silently skips malformed JSON lines. Tests use require.cache injection for electron module mock and mock.method on byokConfig.readConfig to avoid real Electron dependency, exercising all code paths: validation, HTTP error mapping, network errors, missing API key, streaming chunk accumulation, SSE edge cases, request tracking, and system prompt prepending.

## Verification

Ran node --test test-t03.cjs — 31 tests pass (14 suites). Also verified existing test-t01.cjs (19 tests) and test-t02.cjs (22 tests) still pass — 72 total passing. Verified node --check callLLM.js clean syntax.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node --check newIDE/electron-app/app/byok/callLLM.js` | 0 | ✅ pass | 80ms |
| 2 | `node --test newIDE/electron-app/app/byok/test-t03.cjs` | 0 | ✅ pass | 461ms |
| 3 | `node --test newIDE/electron-app/app/byok/test-t01.cjs newIDE/electron-app/app/byok/test-t02.cjs` | 0 | ✅ pass | 120ms |

## Deviations

Installed fs-extra (declared dependency in app/package.json) in electron-app/app/node_modules to allow test execution; the test file also mocks the electron module via Module._resolveFilename patching since it's unavailable outside Electron runtime.

## Known Issues

None.

## Files Created/Modified

- `newIDE/electron-app/app/byok/callLLM.js`
- `newIDE/electron-app/app/byok/test-t03.cjs`
