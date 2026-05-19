---
estimated_steps: 5
estimated_files: 2
skills_used: []
---

# T01: Create errors.js and buildSystemPrompt.js modules

Why: errors.js provides structured error handling for all BYOK modules (typed error codes: INVALID_KEY, ENDPOINT_UNREACHABLE, MODEL_NOT_FOUND, RATE_LIMITED, UNKNOWN). buildSystemPrompt.js assembles the system prompt for AI requests — both are foundational pure-JS modules with no Electron dependency.

Do:
1. Create byok/errors.js with ByokError class extending Error, static factory methods for each error code, and a toJSON() method for IPC serialization
2. Create byok/buildSystemPrompt.js with a function that takes { provider, model, locale } and returns an assembled system prompt string

Both use CommonJS module.exports pattern. No new npm dependencies.

## Inputs

- None specified.

## Expected Output

- `newIDE/electron-app/app/byok/errors.js`
- `newIDE/electron-app/app/byok/buildSystemPrompt.js`

## Verification

node --check newIDE/electron-app/app/byok/errors.js && node --check newIDE/electron-app/app/byok/buildSystemPrompt.js
