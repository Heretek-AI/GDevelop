---
estimated_steps: 9
estimated_files: 4
skills_used: []
---

# T05: Write and run unit tests for pure JS modules

Why: errors.js, buildSystemPrompt.js, requestStore.js, and callLLM.js are pure JavaScript with no Electron dependency and can be unit tested using Node 22's built-in node:test runner. Tests provide regression protection for downstream slices.

Do:
1. Create byok/tests/ directory
2. Write byok/tests/errors.test.js — test ByokError creation, each error code factory, toJSON() output, instanceof checks
3. Write byok/tests/buildSystemPrompt.test.js — test prompt assembly with different providers, locale handling
4. Write byok/tests/requestStore.test.js — test create/get/abort/cleanup lifecycle, status transitions, error state
5. Write byok/tests/callLLM.test.js — test input validation (missing endpoint, key, model), error type mapping without making real API calls

Run with: node --test
Note: byokConfig.js depends on Electron (app.getPath), so excluded from unit tests.

## Inputs

- `newIDE/electron-app/app/byok/errors.js`
- `newIDE/electron-app/app/byok/buildSystemPrompt.js`
- `newIDE/electron-app/app/byok/requestStore.js`
- `newIDE/electron-app/app/byok/callLLM.js`

## Expected Output

- `newIDE/electron-app/app/byok/tests/errors.test.js`
- `newIDE/electron-app/app/byok/tests/buildSystemPrompt.test.js`
- `newIDE/electron-app/app/byok/tests/requestStore.test.js`
- `newIDE/electron-app/app/byok/tests/callLLM.test.js`

## Verification

node --test newIDE/electron-app/app/byok/tests/
