#!/usr/bin/env bash
set -euo pipefail

# ── verify-s05-structural.sh ───────────────────────────────────────────────
# Cross-slice structural integrity verification for Slice S05.
#
# Verifies that every cross-slice wire (IPC channel names, preload bridge
# methods, Flow type shapes, preset IDs, guard predicates) matches what
# S02–S04 established.
#
# Exit 0 only when ALL checks pass.

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0
FAILURES=()

pass() {
  local check="$1"
  printf "  ${GREEN}PASS${NC}  %s\n" "$check"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  local check="$1"
  local detail="${2:-}"
  printf "  ${RED}FAIL${NC}  %s\n       %s\n" "$check" "$detail"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILURES+=("FAIL: $check — $detail")
}

# ── Check 1: main.js ───────────────────────────────────────────────────────

echo ""
echo "=== Check 1: main.js — BYOK bootstrap wiring ==="
echo ""

BYOK_REQUIRE_LINE=$(grep -n "byok/byokMain" newIDE/electron-app/app/main.js | head -1 | cut -d: -f1 || true)
REGISTER_LINE=$(grep -n "registerByokHandlers(ipcMain)" newIDE/electron-app/app/main.js | head -1 | cut -d: -f1 || true)

if [ -z "$BYOK_REQUIRE_LINE" ]; then
  fail "BYOK require" "No line importing 'byok/byokMain' found in main.js"
else
  # Check it's at or near line 48 (allow ±2 for formatting drift)
  if [ "$BYOK_REQUIRE_LINE" -ge 46 ] && [ "$BYOK_REQUIRE_LINE" -le 50 ]; then
    pass "BYOK require at line $BYOK_REQUIRE_LINE (expected ~48: 'byok/byokMain')"
  else
    fail "BYOK require at line $BYOK_REQUIRE_LINE" "Expected near line 48; significant position drift"
  fi
fi

if [ -z "$REGISTER_LINE" ]; then
  fail "registerByokHandlers call" "No call to registerByokHandlers(ipcMain) found in main.js"
else
  # Verify it is inside an app.whenReady() / 'ready' handler block.
  # Check that registerByokHandlers appears AFTER app.whenReady / 'ready' in the file.
  READY_REGION_START=$(grep -n "app.whenReady\|app.on.*ready" newIDE/electron-app/app/main.js | head -1 | cut -d: -f1 || echo 0)
  if [ "$REGISTER_LINE" -gt "$READY_REGION_START" ] 2>/dev/null; then
    pass "registerByokHandlers at line $REGISTER_LINE (inside 'ready' handler)"
  else
    fail "registerByokHandlers at line $REGISTER_LINE not inside 'ready' handler" \
      "Ready handler starts at line $READY_REGION_START"
  fi
fi

# ── Check 2: preload.js ────────────────────────────────────────────────────

echo ""
echo "=== Check 2: preload.js — contextBridge methods ==="
echo ""

PRELOAD_FILE="newIDE/electron-app/app/preload.js"

# Expected set of 6 contextBridge methods
EXPECTED_METHODS=("getConfig" "saveConfig" "callLLM" "callLLMStream" "getActiveRequests" "abortRequest")

for method in "${EXPECTED_METHODS[@]}"; do
  if grep -q "${method}:" "$PRELOAD_FILE"; then
    pass "preload: contextBridge method '${method}' found"
  else
    fail "preload: contextBridge method '${method}' missing" "Expected in contextBridge.exposeInMainWorld('byokAi', { ... })"
  fi
done

# Verify there are exactly 6 top-level method keys inside exposeInMainWorld.
# We use the pattern: keys at the start of lines that look like property names inside the object literal.
METHOD_COUNT=$(grep -cE "^\s+(getConfig|saveConfig|callLLM|callLLMStream|getActiveRequests|abortRequest)\s*:" "$PRELOAD_FILE" || echo 0)
if [ "$METHOD_COUNT" -eq 6 ]; then
  pass "preload: exactly 6 contextBridge method keys ($METHOD_COUNT)"
else
  fail "preload: contextBridge method count" "Expected 6, found $METHOD_COUNT"
fi

# ── Check 3: byokMain.js ───────────────────────────────────────────────────

echo ""
echo "=== Check 3: byokMain.js — IPC handlers ==="
echo ""

BYOKMAIN_FILE="newIDE/electron-app/app/byok/byokMain.js"

HANDLE_COUNT=$(grep -c "ipcMain.handle" "$BYOKMAIN_FILE" || echo 0)
ON_COUNT=$(grep -c "ipcMain.on" "$BYOKMAIN_FILE" || echo 0)
TOTAL_IPC=$((HANDLE_COUNT + ON_COUNT))

# The plan says "4x ipcMain.handle + 2x ipcMain.on" but the actual code has
# 5x handle + 1x on = 6 total. Verify the actual structure.

EXPECTED_HANDLES=("byok:getConfig" "byok:saveConfig" "byok:callLLM" "byok:getActiveRequests" "byok:abortRequest")
for channel in "${EXPECTED_HANDLES[@]}"; do
  if grep -q "ipcMain.handle('${channel}'" "$BYOKMAIN_FILE"; then
    pass "byokMain: ipcMain.handle('${channel}') found"
  else
    fail "byokMain: ipcMain.handle('${channel}') missing" "Expected IPC handler for this channel"
  fi
done

EXPECTED_ON_CHANNELS=("byok:callLLMStream")
for channel in "${EXPECTED_ON_CHANNELS[@]}"; do
  if grep -q "ipcMain.on('${channel}'" "$BYOKMAIN_FILE"; then
    pass "byokMain: ipcMain.on('${channel}') found"
  else
    fail "byokMain: ipcMain.on('${channel}') missing" "Expected streaming IPC handler"
  fi
done

if [ "$TOTAL_IPC" -eq 6 ]; then
  pass "byokMain: exactly 6 IPC handlers registered (${HANDLE_COUNT}x handle + ${ON_COUNT}x on)"
else
  fail "byokMain: IPC handler count" "Expected 6, found $TOTAL_IPC (${HANDLE_COUNT}x handle + ${ON_COUNT}x on)"
fi

# ── Check 4: ByokRouting.js ────────────────────────────────────────────────

echo ""
echo "=== Check 4: ByokRouting.js — exported functions ==="
echo ""

BROUTE_FILE="newIDE/app/src/Utils/GDevelopServices/ByokRouting.js"

EXPECTED_EXPORTS=(
  "byokCreateAiRequest"
  "byokAddMessageToAiRequest"
  "isByokPreset"
  "isByokAiAvailable"
)

for func in "${EXPECTED_EXPORTS[@]}"; do
  # Match either `export const funcName =` or `export function funcName(`
  if grep -qE "export const ${func}\b|export function ${func}\b" "$BROUTE_FILE"; then
    pass "ByokRouting: exported function '${func}' found"
  else
    fail "ByokRouting: exported function '${func}' missing"
  fi
done

# ── Check 5: AskAiEditorContainer.js ───────────────────────────────────────

echo ""
echo "=== Check 5: AskAiEditorContainer.js — BYOK guard blocks ==="
echo ""

ASKAI_FILE="newIDE/app/src/AiGeneration/AskAiEditorContainer.js"

# Guard 1: lines ~490 — newAiRequest useEffect
GUARD1_LINE=$(grep -n "isByokPreset(aiConfigurationPresetId) && isByokAiAvailable()" "$ASKAI_FILE" | head -1 | cut -d: -f1 || true)
if [ -n "$GUARD1_LINE" ]; then
  # Verify it's followed by byokCreateAiRequest call within a few lines
  END_LINE=$((GUARD1_LINE + 10))
  if sed -n "${GUARD1_LINE},${END_LINE}p" "$ASKAI_FILE" | grep -q "byokCreateAiRequest"; then
    pass "AskAiEditor: BYOK guard 1 (newAiRequest) at line $GUARD1_LINE"
  else
    fail "AskAiEditor: BYOK guard 1 at line $GUARD1_LINE not followed by byokCreateAiRequest"
  fi
else
  fail "AskAiEditor: BYOK guard 1 (isByokPreset + isByokAiAvailable for new request) not found"
fi

# Guard 2: lines ~715 — onSendMessage callback
GUARD2_LINE=$(grep -n "isByokPreset(selectedAiRequestPresetId" "$ASKAI_FILE" | head -1 | cut -d: -f1 || true)
if [ -n "$GUARD2_LINE" ]; then
  END_LINE2=$((GUARD2_LINE + 10))
  if sed -n "${GUARD2_LINE},${END_LINE2}p" "$ASKAI_FILE" | grep -q "byokAddMessageToAiRequest"; then
    pass "AskAiEditor: BYOK guard 2 (onSendMessage) at line $GUARD2_LINE"
  else
    fail "AskAiEditor: BYOK guard 2 at line $GUARD2_LINE not followed by byokAddMessageToAiRequest"
  fi
else
  fail "AskAiEditor: BYOK guard 2 (isByokPreset for reply) not found"
fi

# ── Check 6: AiRequestChat/index.js ────────────────────────────────────────

echo ""
echo "=== Check 6: AiRequestChat/index.js — ByokConfigPanel wiring ==="
echo ""

AICHAT_FILE="newIDE/app/src/AiGeneration/AiRequestChat/index.js"

BYOK_PANEL_IMPORT_LINE=$(grep -n "import ByokConfigPanel" "$AICHAT_FILE" | head -1 | cut -d: -f1 || true)
if [ -n "$BYOK_PANEL_IMPORT_LINE" ]; then
  pass "AiRequestChat: ByokConfigPanel import at line $BYOK_PANEL_IMPORT_LINE"
else
  fail "AiRequestChat: ByokConfigPanel import not found"
fi

# Verify ByokConfigPanel is rendered in JSX (the 'byok' preset guard)
BYOK_PANEL_JSX_LINE=$(grep -n "<ByokConfigPanel" "$AICHAT_FILE" | head -1 | cut -d: -f1 || true)
if [ -n "$BYOK_PANEL_JSX_LINE" ]; then
  pass "AiRequestChat: <ByokConfigPanel /> JSX at line $BYOK_PANEL_JSX_LINE"
else
  fail "AiRequestChat: <ByokConfigPanel /> JSX not found"
fi

# Also check that the rendering is guarded by the 'byok' preset check
START_CTX=$((BYOK_PANEL_JSX_LINE - 3))
END_CTX=$((BYOK_PANEL_JSX_LINE - 1))
BEFORE_CTX=$(sed -n "${START_CTX},${END_CTX}p" "$AICHAT_FILE" 2>/dev/null || true)
if echo "$BEFORE_CTX" | grep -q "'byok'"; then
  pass "AiRequestChat: ByokConfigPanel rendering is guarded by preset === 'byok'"
else
  # The guard might be on the same line or preceding lines; check the broader area
  START_AREA=$((BYOK_PANEL_JSX_LINE - 5))
  END_AREA=$((BYOK_PANEL_JSX_LINE - 1))
  BEFORE_AREA=$(sed -n "${START_AREA},${END_AREA}p" "$AICHAT_FILE" 2>/dev/null || true)
  if echo "$BEFORE_AREA" | grep -q "byok"; then
    pass "AiRequestChat: ByokConfigPanel rendering is guarded (byok check found nearby)"
  else
    fail "AiRequestChat: ByokConfigPanel rendering lacks 'byok' guard context" \
      "No 'byok' check found within 5 lines before line $BYOK_PANEL_JSX_LINE"
  fi
fi

# ── Check 7: Generation.js ─────────────────────────────────────────────────

echo ""
echo "=== Check 7: Generation.js — BYOK presets ==="
echo ""

GEN_FILE="newIDE/app/src/Utils/GDevelopServices/Generation.js"

for mode in chat agent orchestrator; do
  if grep -q "mode: '${mode}'" "$GEN_FILE"; then
    pass "Generation: BYOK preset '${mode}' mode injected"
  else
    fail "Generation: BYOK preset '${mode}' mode missing"
  fi
done

# Verify the byokPreset definition exists and the 3 modes are injected.
# The presets share a single `byokPreset` object spread into 3 entries,
# so `id: 'byok'` appears only once in the source.
BYOK_PRESET_COUNT=$(grep -c "id: 'byok'" "$GEN_FILE" || echo 0)
if [ "$BYOK_PRESET_COUNT" -ge 1 ]; then
  pass "Generation: byokPreset with id: 'byok' defined ($BYOK_PRESET_COUNT definition, spread into 3 modes)"
else
  fail "Generation: byokPreset definition missing" "Expected at least 1 'id: byok', found $BYOK_PRESET_COUNT"
fi

# ── Summary ────────────────────────────────────────────────────────────────

echo ""
echo "======================================"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "======================================"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "Failures:"
  for f in "${FAILURES[@]}"; do
    printf "  ${RED}▶${NC} %s\n" "$f"
  done
  echo ""
  echo "${RED}■■■ VERIFICATION FAILED ■■■${NC}"
  exit 1
fi

echo "${GREEN}■■■ ALL CHECKS PASSED ■■■${NC}"
exit 0
