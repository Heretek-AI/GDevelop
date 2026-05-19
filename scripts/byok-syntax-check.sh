#!/bin/bash
# T03: Syntax validation on all BYOK-related modules
set -e

echo "=== MAIN PROCESS (must pass cleanly) ==="
main_pass=0
main_fail=0

MAIN_FILES=(
  "newIDE/electron-app/app/byok/errors.js"
  "newIDE/electron-app/app/byok/buildSystemPrompt.js"
  "newIDE/electron-app/app/byok/byokConfig.js"
  "newIDE/electron-app/app/byok/requestStore.js"
  "newIDE/electron-app/app/byok/callLLM.js"
  "newIDE/electron-app/app/byok/byokMain.js"
  "newIDE/electron-app/app/preload.js"
)

for f in "${MAIN_FILES[@]}"; do
  out=$(node --check "$f" 2>&1)
  rc=$?
  if [ $rc -eq 0 ]; then
    echo "PASS main: $f"
    main_pass=$((main_pass+1))
  else
    echo "FAIL main: $f (rc=$rc)"
    echo "  $out"
    main_fail=$((main_fail+1))
  fi
done

echo ""
echo "=== RENDERER (Flow annotations expected — note genuine errors) ==="
ren_pass=0
ren_flow=0
ren_fail=0

RENDERER_FILES=(
  "newIDE/app/src/Utils/GDevelopServices/ByokRouting.js"
  "newIDE/app/src/Utils/GDevelopServices/Generation.js"
  "newIDE/app/src/Utils/GDevelopServices/Usage.js"
  "newIDE/app/src/AiGeneration/AiRequestChat/ByokConfigPanel.js"
  "newIDE/app/src/AiGeneration/AiRequestChat/index.js"
)

for f in "${RENDERER_FILES[@]}"; do
  out=$(node --check "$f" 2>&1)
  rc=$?
  if [ $rc -eq 0 ]; then
    echo "PASS renderer: $f"
    ren_pass=$((ren_pass+1))
  else
    # Classify: Flow-only vs genuine error
    is_flow_only=true
    while IFS= read -r line; do
      if echo "$line" | grep -q "SyntaxError"; then
        # Known Flow patterns
        if echo "$line" | grep -qE "Missing initializer in const|Unexpected token.*typeof|Unexpected token ':'|Unexpected token '\('" ; then
          :
        else
          is_flow_only=false
        fi
      fi
    done <<< "$out"

    if [ "$is_flow_only" = true ]; then
      echo "FLOW renderer: $f (Flow annotations only — acceptable)"
      ren_flow=$((ren_flow+1))
    else
      echo "FAIL renderer: $f (genuine syntax error)"
      echo "$out" | head -10
      ren_fail=$((ren_fail+1))
    fi
  fi
done

echo ""
echo "=== SUMMARY ==="
echo "Main:   $main_pass passed, $main_fail failed (of 7)"
echo "Render: $ren_pass clean, $ren_flow flow-only, $ren_fail genuine errors (of 5)"
echo "Total files: 12"

if [ $main_fail -gt 0 ] || [ $ren_fail -gt 0 ]; then
  exit 1
fi
exit 0
