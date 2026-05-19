# M001: BYOK Fork

**Vision:** GDevelop IDE fully unlocked with BYOK AI routing through user-owned LLM keys, built directly into the source.

## Success Criteria

- GDevelop launches without errors with all BYOK changes applied
- No subscription gate or upsell visible
- No Made with GDevelop watermark on preview
- BYOK preset visible in AI configuration dropdown
- Config panel renders with provider/endpoint/key/model fields when BYOK selected
- Saving config persists across app restart
- Chat request with BYOK preset calls configured LLM and returns response
- Chat request with non-BYOK preset still works normally

## Slices

- [x] **S01: S01** `risk:low` `depends:[]`
  > After this: IDE launches with subscription valid, max limits, no watermark

- [x] **S02: S02** `risk:medium` `depends:[]`
  > After this: window.byokAi available in renderer, IPC handlers registered in main process

- [x] **S03: S03** `risk:medium` `depends:[]`
  > After this: BYOK preset appears in dropdown, selecting it routes AI requests through local IPC

- [x] **S04: S04** `risk:low` `depends:[]`
  > After this: Config panel renders with provider/endpoint/key/model fields, settings persist across restart

- [x] **S05: S05** `risk:low` `depends:[]`
  > After this: Full end-to-end: premium unlock active, BYOK chat works, non-BYOK presets still functional

## Boundary Map

Not provided.
