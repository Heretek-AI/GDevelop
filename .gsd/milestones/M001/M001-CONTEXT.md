# M001: BYOK Fork

**Gathered:** 2026-01-19
**Status:** Ready for planning

## Project Description

A personal fork of GDevelop with premium unlock and BYOK AI routing built directly into the source. No patch-on-apply system — the changes live natively in the codebase. The IDE launches fully unlocked (no subscription checks, no watermark, max limits) and AI chat/agent features route through the user's own LLM API keys when the BYOK preset is selected.

## Why This Milestone

The upstream BYOK fork (Heretek-AI/GDevelop-BYOK) used a regex-based patching system that doesn't match the current GDevelop source. Building the changes directly into a fork is simpler, more maintainable, and avoids fragile text-matching.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Open GDevelop with all premium features unlocked — no subscription prompts, no watermark, no usage limits
- Select "BYOK (Bring Your Own Key)" from the AI configuration preset dropdown
- Configure their LLM provider (OpenAI, Anthropic, Ollama, or any OpenAI-compatible endpoint) with API key and model
- Use AI chat features routed through their own LLM keys — no GDevelop credits needed
- Restart the app and have their BYOK config persisted

### Entry point / environment

- Entry point: Electron desktop app (`newIDE/electron-app`)
- Environment: local dev (node, electron)
- Live dependencies involved: user's LLM provider API (OpenAI/Anthropic/Ollama/etc.)

## Completion Class

- Contract complete means: every modified file exists with the correct changes, BYOK modules export expected interfaces
- Integration complete means: preload bridge → IPC handler → LLM call works end-to-end in a running Electron instance
- Operational complete means: config persists across restarts, non-BYOK presets still work

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- GDevelop launches without errors with all BYOK changes in place
- Selecting BYOK preset and sending a chat message makes a real LLM API call and returns a response
- Config survives app restart

## Architectural Decisions

### S01: Return-value bypass for subscription and limits

**Decision:** Modify `hasValidSubscriptionPlan()` to always return `true` and `getUserLimits()` to return a hardcoded max-limits object without making an API call.

**Rationale:** These are the two choke points for premium gating. Bypassing at the function level means all downstream callers automatically get unlocked behavior without further changes.

**Alternatives Considered:**
- Intercepting at the network layer — rejected because it's fragile and would still make unnecessary API calls
- Patching every caller individually — rejected because the functions are imported in many places

### S02: IPC-based AI routing instead of standalone proxy

**Decision:** Route AI requests through Electron IPC (main process handler + preload bridge) rather than a standalone proxy server.

**Rationale:** No external process to manage, no port conflicts, works within Electron's security model via contextBridge. Simpler for a personal fork.

**Alternatives Considered:**
- Standalone proxy server (like BYOK fork's `proxy/server.js`) — rejected because it requires starting a separate process and managing ports
- Patching at the HTTP client level — rejected because it would intercept all API calls, not just AI

### S03: Preset injection at fetchAiSettings level

**Decision:** Append the BYOK preset to the presets array inside `fetchAiSettings()` in `Generation.js`.

**Rationale:** `fetchAiSettings()` is the single source of truth for presets. All downstream consumers (AiConfiguration.js, preset selector, chat UI) pick up the change automatically.

**Alternatives Considered:**
- Injecting at the preset selector UI level — rejected because the preset would be invisible to AiConfiguration logic
- Modifying the CDN JSON — rejected because it's not version-controlled and could be overwritten

### S04: Plain JSON config in userData directory

**Decision:** Store BYOK config as plain JSON at `app.getPath('userData')/byok-config.json`. No new dependencies.

**Rationale:** For personal use, file permissions are sufficient. Avoids the electron-store dependency and safeStorage complexity.

**Alternatives Considered:**
- electron-store with safeStorage — rejected because it adds a dependency and OS keychain complexity unnecessary for personal use

## Error Handling Strategy

- LLM API failures return structured `ByokError` with codes (INVALID_KEY, ENDPOINT_UNREACHABLE, MODEL_NOT_FOUND, RATE_LIMITED, UNKNOWN) and user-facing messages
- 30s timeout for cloud endpoints, 60s for localhost
- Errors propagate via IPC rejection → renderer surfaces in chat UI
- Missing/unreadable config → empty defaults (no crash)
- `window.byokAi` missing → `addMessageToAiRequest` falls through to normal GDevelop API — no breakage
- No automatic retry on failure (avoids burning credits)

## Risks and Unknowns

- `addMessageToAiRequest` has a complex call signature and return type — the BYOK interceptor must return a valid `AiRequest` shape — getting this wrong could break compilation or runtime
- The BrowserWindow creation in `main.js` is dense — finding the right spot for preload registration requires care
- No automated tests exist in this codebase — verification is manual

## Existing Codebase / Prior Art

- `newIDE/app/src/Utils/GDevelopServices/Usage.js` — subscription/limits functions to bypass
- `Core/GDCore/Project/Watermark.cpp` — watermark defaults to override
- `newIDE/app/src/Utils/GDevelopServices/Generation.js` — AI settings fetch + request routing
- `newIDE/app/src/AiGeneration/AiConfiguration.js` — preset availability logic
- `newIDE/app/src/AiGeneration/AiRequestChat/index.js` — chat UI component
- `newIDE/electron-app/app/main.js` — Electron entry, BrowserWindow creation

## Relevant Requirements

- R001-R003 — Premium unlock (S01)
- R004-R005 — AI routing (S03)
- R006-R007 — IPC infrastructure (S02)
- R008-R009 — Config UI + persistence (S04)
- R010 — Non-BYOK regression (S05)

## Scope

### In Scope

- Subscription bypass in Usage.js
- Limits bypass in Usage.js
- Watermark disabled in Watermark.cpp
- BYOK preset injection in Generation.js
- AI request IPC routing in Generation.js
- Electron preload script exposing window.byokAi
- IPC handler registration in main.js
- Five proxy modules: callLLM, errors, byokConfig, requestStore, buildSystemPrompt
- ByokConfigPanel React component
- Config persistence to JSON file
- Non-BYOK preset regression safety

### Out of Scope / Non-Goals

- Patching system or manifest engine
- Standalone proxy server
- Web app support
- Test fixtures or automated tests
- electron-store or safeStorage encryption
- Multi-provider routing logic beyond OpenAI-compatible API

## Technical Constraints

- No new npm dependencies
- Electron-only (web app not modified)
- Flow type annotations must be maintained for new React components
- C++ changes must follow existing GDCore conventions

## Integration Points

- `main.js` — IPC handler registration + preload script path
- `Generation.js` — AI settings fetch + request routing intercept
- `AiRequestChat/index.js` — config panel conditional rendering

## Testing Requirements

Manual smoke testing:
- App launches without errors
- Chat AI with BYOK preset routes to configured LLM
- Config persists across restart
- Non-BYOK presets still functional

## Acceptance Criteria

- [ ] GDevelop launches without errors with all BYOK changes
- [ ] No subscription gate or upsell visible
- [ ] No "Made with GDevelop" watermark on preview
- [ ] BYOK preset visible in AI configuration dropdown
- [ ] Config panel renders with provider/endpoint/key/model fields
- [ ] Saving config persists across restart
- [ ] Chat request with BYOK preset calls configured LLM and returns response
- [ ] Chat request with non-BYOK preset still works normally
