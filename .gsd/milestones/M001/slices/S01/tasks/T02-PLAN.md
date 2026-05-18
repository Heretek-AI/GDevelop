---
estimated_steps: 6
estimated_files: 1
skills_used: []
---

# T02: Bypass hasValidSubscriptionPlan to always return true

Why: R001 requires hasValidSubscriptionPlan() to return true unconditionally, removing all subscription gating. Called by ~15 consumers across the IDE.

Do:
1. Edit hasValidSubscriptionPlan() in Usage.js (line 541). Replace the body with `return true;`
2. Keep the function signature and exported status
3. Preserve Flow type annotations and all surrounding code

Done when: Function body unconditionally returns true.

## Inputs

- `newIDE/app/src/Utils/GDevelopServices/Usage.js`

## Expected Output

- `newIDE/app/src/Utils/GDevelopServices/Usage.js`

## Verification

grep -q "return true" newIDE/app/src/Utils/GDevelopServices/Usage.js
