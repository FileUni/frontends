# frontends/gui - Tauri GUI Launcher

Bun + Astro 5 + React 19 + Tailwind CSS 4 + Tauri 2.x desktop launcher for FileUni.

## Special Characteristics

- Runs in Tauri WebView, not a browser
- Uses `@tauri-apps/api` for native IPC (`invoke`, `listen`)
- Consumes `@fileuni/shared` for common UI components and state

## Key Paths

| Path | Description |
|------|-------------|
| `src/components/Launcher.tsx` | Main launcher UI |
| `src/lib/tauri.ts` | Tauri IPC wrappers (`safeInvoke`, `safeListen`) |
| `src/stores/config.ts` | Runtime directory persistence |

## Technical Constraints

- **Tauri API Access**: Use `safeInvoke`/`safeListen` from `src/lib/tauri.ts`, not direct `@tauri-apps/api` imports in components
- **Shared Components**: Import from `@fileuni/shared`, not from `../shared/src/...`
- **i18n**: Initialize at module top-level via `src/lib/i18n.ts`
- **Theme/Language**: Preload in `src/pages/index.astro` to avoid FOUC
