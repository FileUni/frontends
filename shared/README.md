# frontends/shared Module Description

## Overview
- This module is the shared frontend implementation layer for CLI WebUI and GUI Launcher, responsible for single-point implementation of common components, common state, and common utility functions.
- The goal is to ensure consistent interaction between both interfaces, avoiding dual implementation and behavior drift in `cli` and `gui`.

## Key Paths
- Shared export facade: `shared/src/index.ts`
- Shared components: `shared/src/components/`
- Shared state: `shared/src/stores/`
- Shared utilities: `shared/src/lib/`

## Interaction and Division of Labor with Other Modules
- `cli` and `gui` only handle shell assembly and platform adaptation (e.g., Tauri `invoke`, browser API).
- All reusable UI (config path selection, config editing, log panel, service control, shortcuts) should be prioritized to sink into this module.
- Both interfaces MUST use capabilities exported only through `@fileuni/shared`'s `index.ts`, cross-directory direct references to internal implementation files are prohibited.

## Technical Constraints and Specifications
- New common components should be placed in `shared/src/components/` by default; only retain components in business layer when they are strongly coupled with platform API.
- Component API must remain platform-agnostic, with data sources and actions injected via callbacks; avoid hardcoding Tauri or backend paths within shared.
- `stores/theme`, `stores/language`, `stores/toast` are the single source of common state; CLI/GUI must not duplicate similar stores.
- After upgrading shared components, both `cli` and `gui` builds must be verified to ensure no interface breakage.
