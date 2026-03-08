# frontends/shared - Common Frontend Module

Shared components, stores, and utilities for `cli/` and `gui/`.

## Key Paths

| Path | Description |
|------|-------------|
| `src/index.ts` | Public API facade |
| `src/components/` | Shared UI components |
| `src/stores/` | Shared state (theme, language, toast) |
| `src/lib/` | Shared utilities |

## Technical Constraints

- **Platform-Agnostic**: Components must not hardcode Tauri or backend paths; inject via props/callbacks
- **Single Source**: `cli/` and `gui/` MUST import from `@fileuni/shared`, not internal paths
- **No Duplication**: Do not create duplicate stores in cli/gui for theme/language/toast