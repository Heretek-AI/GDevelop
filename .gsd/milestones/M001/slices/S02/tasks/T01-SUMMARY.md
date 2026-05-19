---
id: T01
parent: S02
milestone: M001
key_files:
  - newIDE/electron-app/app/byok/errors.js
  - newIDE/electron-app/app/byok/buildSystemPrompt.js
  - newIDE/electron-app/app/byok/test-t01.cjs
key_decisions:
  - ByokError extends Error with toJSON() for IPC serialization — without this, structured clone loses custom Error properties across the contextBridge
  - Error codes stored in frozen ByokErrorCodes object exposed as ByokError.codes for both internal use and renderer-side type checking
  - buildSystemPrompt accepts {context, language} as the public API signature, with DEFAULT_SYSTEM_PROMPT exported for testing and reuse
duration: 
verification_result: passed
completed_at: 2026-05-19T01:37:41.410Z
blocker_discovered: false
---

# T01: Created errors.js with typed ByokError class and buildSystemPrompt.js with configurable system prompt assembly — both pure-JS modules with 19 passing tests

**Created errors.js with typed ByokError class and buildSystemPrompt.js with configurable system prompt assembly — both pure-JS modules with 19 passing tests**

## What Happened


Created the byok/ directory at newIDE/electron-app/app/byok/ with two foundational pure-JS modules and a test suite.

**errors.js** — ByokError class extending Error with a frozen ByokErrorCodes object containing 5 typed codes: INVALID_KEY, ENDPOINT_UNREACHABLE, MODEL_NOT_FOUND, RATE_LIMITED, UNKNOWN. Includes static factory methods (invalidKey(), endpointUnreachable(), etc.) that construct properly-typed errors, and a toJSON() method that flattens the error for Electron IPC serialization (preserving code, message, statusCode, stack, and cause).

**buildSystemPrompt.js** — Exports buildSystemPrompt({ context, language }) which assembles a system prompt from a built-in DEFAULT_SYSTEM_PROMPT describing the assistant's role in GDevelop, with optional user-provided context injection and language preference. Handles whitespace-only inputs gracefully.

**test-t01.cjs** — 19 tests across 3 suites using Node 22's built-in node:test and node:assert. Covers: Error inheritance, code/message storage, all 5 error codes, ByokError.codes exposure, IPC toJSON() serialization with cause chaining, all 5 factory methods, string return type, default prompt, context inclusion, whitespace trimming, language preference, combined context+language, and empty-input edge cases.

Both modules use CommonJS module.exports pattern consistent with the existing electron-app convention. No new npm dependencies.


## Verification


Syntax checks passed for both errors.js and buildSystemPrompt.js via `node --check`. Full test suite ran with `node --test test-t01.cjs`: 19/19 tests passed across ByokError (7 tests + 5 nested factory tests) and buildSystemPrompt (8 tests). All 5 error codes verified to exist with correct values. ByokError confirmed as instanceof Error. buildSystemPrompt confirmed to return strings, include context, respect language preference, and handle edge cases (empty strings, whitespace-only).


## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node --check newIDE/electron-app/app/byok/errors.js` | 0 | ✅ pass | 150ms |
| 2 | `node --check newIDE/electron-app/app/byok/buildSystemPrompt.js` | 0 | ✅ pass | 140ms |
| 3 | `node --test newIDE/electron-app/app/byok/test-t01.cjs` | 0 | ✅ pass (19/19) | 66ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `newIDE/electron-app/app/byok/errors.js`
- `newIDE/electron-app/app/byok/buildSystemPrompt.js`
- `newIDE/electron-app/app/byok/test-t01.cjs`
