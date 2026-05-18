---
estimated_steps: 6
estimated_files: 1
skills_used: []
---

# T01: Disable watermark in Watermark.cpp defaults

Why: R003 requires the Made with GDevelop watermark to be disabled by default. The Watermark.cpp constructor initializes showWatermark to true, and UnserializeFrom falls back to true when the attribute is missing.

Do:
1. In Watermark.cpp constructor (line 13): change `showWatermark(true)` to `showWatermark(false)`
2. In Watermark.cpp UnserializeFrom (line 21): change `GetBoolAttribute("showWatermark", true)` to `GetBoolAttribute("showWatermark", false)`
3. Preserve all existing copyright headers, includes, namespace conventions.

Done when: Both constructor initializer and UnserializeFrom fallback default to false.

## Inputs

- `Core/GDCore/Project/Watermark.cpp`

## Expected Output

- `Core/GDCore/Project/Watermark.cpp`

## Verification

grep -q "showWatermark(false)" Core/GDCore/Project/Watermark.cpp
