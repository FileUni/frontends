# frontends/cli - CLI WebUI

Bun + Astro 5 + React 19 + Tailwind CSS 4 + shadcn/ui, SSG embedded in Rust binary.

## Special Characteristics

- Fully static (SSG), no SSR support
- Embedded in Rust binary via `rust_embed::RustEmbed` macro
- Served at `/ui` path, API type-synced from backend OpenAPI

## Key Paths

| Path | Description |
|------|-------------|
| `src/lib/storageHub.ts` | Unified cache manager entry (LocalStorage + IndexedDB) |
| `src/lib/api.ts` | Type-safe API client via `openapi-fetch` |
| `src/layouts/Layout.astro` | First-screen theme/language preload |

## Technical Constraints

- **Cache**: All business cache MUST go through `storageHub.ts`; direct browser cache API calls prohibited
- **Types**: Run `bun run gen-api` after backend API changes; manual type definitions forbidden
- **i18n**: Missing keys fallback to English, then display `[key_name]`
- **Account Isolation**: Cache keys must be isolated by `userId` (e.g., `chat_*_${userId}`)