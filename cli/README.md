# frontends/cli - Static Frontend Resource Management Module

This is the static frontend resource management module for the FileUni system. Built with Bun + Astro + React + shadcn/ui, it generates static files that are fully embedded into the Rust binary, achieving integrated frontend-backend deployment.

## Overview

As the frontend presentation layer of the FileUni system, the cli module is designed for static embedding, providing a complete user interface and interactive features. Built on React 19 with Astro SSG (Static Site Generation) mode.

## Caching Specification (Simplified)

- **Unified Entry**: Business code MUST read/write cache ONLY through `cli/src/lib/storageHub.ts`, with statistics/cleanup via `cli/src/lib/cacheManager.ts`. Direct browser cache API calls are prohibited.
- **Layered Strategy**: Small keys use `LocalStorage`; heavy caches (chat history/nicknames, email address book, file management state) use `IndexedDB`.
- **Account Isolation**:
  - Must be isolated: `fileuni_email_contacts_${userId}`, `chat_*_${userId}`, `chat_*_guest_${inviteCode}`, `chat_inviter_id_${inviteCode}`, `ext-ui-overrides:${userId}`.
  - File management uses `fileuni-file-manager-v5` as a single key, but internal `userStates` must be bucketed by `userId`.
  - Login session `fileuni-auth` is a single key container, with internal `usersMap` isolated by `userId`.
- **Global Shared Cache**: `fileuni-theme`, `fileuni-language`, `fileuni-language-raw` (interface preferences).
- **Cleanup Rules**: Default cleanup targets current account; cleanup all accounts only when user explicitly selects; interface preferences only support "clean all accounts".
- **Sole Exception**: `cli/src/layouts/Layout.astro` can directly read `LocalStorage` for first-screen theme/language preloading; other modules cannot bypass the unified cache manager.
- **Management Interface Entry**: `cli/src/features/user-center/components/CacheManagerView.tsx` (`#mod=user&page=cache`).

## Frontend-Backend Configuration Synchronization

- **Route Path**: `/api/v1/system/backend-capabilities-handshake`
- **Function Path**: `get_capabilities` function in `../fileuni-rs/crates/yh-config-aggregator/src/capabilities.rs`
- **Principle**: Frontend calls this API via `useConfigStore().fetchCapabilities()` to retrieve system capability configurations (e.g., `enable_registration`, `enable_sftp`, `enable_webdav`), achieving frontend-backend capability handshake.

## Key Paths

### Static Resource Embedding

- **Path**: `../fileuni-rs/crates/fileuni-lib/src/router/handlers.rs` and `../fileuni-rs/crates/yh-config-mode-api/src/lib.rs`
- **Responsibility**: Packages static files from `cli/dist` into the binary via the `rust_embed::RustEmbed` macro
- **Implementation**: The `static_handler` function handles static file requests and implements SPA fallback mechanism, supporting frontend routing

### API Type Synchronization Mechanism

- **Path**: `../fileuni-rs/crates/fileuni-lib/src/router/openapi.rs` and `cli/src/lib/api.ts`
- **Responsibility**: Backend automatically syncs OpenAPI definitions to frontend during Debug startup, generating type-safe API clients
- **Implementation**: `sync_api_to_frontend()` exports OpenAPI JSON to `cli/openapi.json`, then `bun run gen-api` generates `src/types/api.ts`

### Frontend Build Configuration

- **Path**: `cli/astro.config.mjs` (lines 8-9)
- **Responsibility**: Configures Astro for static mode (SSG), outputting fully independent static files
- **Implementation**: `output: 'static'` and `format: 'file'` ensure static file structure suitable for embedding

### Type-Safe API Client

- **Path**: `cli/src/lib/api.ts`
- **Responsibility**: Implements type-safe HTTP client based on generated API types
- **Implementation**: `openapi-fetch` library combined with backend OpenAPI definitions provides type checking for paths and parameters

## Interaction and Division of Labor

### Interactions

- **Downstream Dependencies**:
  - `openapi-typescript`: For generating API type definitions
  - `openapi-fetch`: For building type-safe API clients
  - `rust-embed`: For embedding static frontend resources in Rust backend

- **Upstream Drivers**:
  - Rust backend (`../fileuni-rs/crates/fileuni-lib/src/router/openapi.rs`): Automatically syncs OpenAPI definitions to frontend
  - Rust router (`../fileuni-rs/crates/fileuni-lib/src/router/handlers.rs`): Serves frontend static files via `RustEmbed` mechanism
  - Frontend build system (`bun run build`): Generates static assets for embedding

### Division of Labor

- **This Module Is Responsible For**:
  - Providing user interface and frontend interactive features
  - Implementing static build and generating assets suitable for embedding
  - Generating type-safe API calls based on backend OpenAPI definitions
  - Implementing SPA routing and state management
- **This Module Is NOT Responsible For**:
  - Server-side rendering or dynamic content generation (fully static)
  - Specific implementation of API endpoints (handled by backend)
  - Runtime compression or serving of static resources (handled by backend's `static_handler`)

## Technical Constraints and Special Algorithms

### Hard Constraints

- **Static Build**: MUST use Astro's `output: 'static'` mode to ensure all resources compile to static files
- **Type Synchronization**: Manual API response type definitions are strictly prohibited; MUST use `bun run gen-api` for auto-generation
- **Embedding Path**: Static resources MUST be built to `cli/dist` directory for Rust's `RustEmbed` macro to read
- **Route Access**: Frontend application MUST be accessed via `/ui` path prefix, ensuring separation from backend API paths
- **Runtime Environment**: Only Bun is supported; Node.js or other JS runtimes are not supported

### Algorithms/Specifications

- **OpenAPI Auto-Sync Algorithm**:
  1. Backend executes `sync_api_to_frontend()` during Debug startup to collect OpenAPI spec from router
  2. Automatically writes to `cli/openapi.json` file
  3. Automatically runs `bun run gen-api` to update frontend type definitions
  4. Ensures complete consistency between frontend and backend API types

- **Static Resource Embedding Algorithm**:
  1. Compile-time uses `rust_embed::RustEmbed` macro to preload `cli/dist` directory contents
  2. Embeds static files into binary, reducing deployment dependencies
  3. Runtime serves files via `static_handler` route
  4. Implements SPA Fallback mechanism, ensuring frontend routing works correctly

- **SPA Fallback Algorithm**:
  1. For unknown requests under `/ui` path, attempt to match corresponding static file
  2. If no matching file found, return `index.html` to support frontend routing
  3. Ensure single-page application routing works correctly in embedded environment

- **Type-Safe API Communication Algorithm**:
  1. Generate precise TypeScript type definitions based on OpenAPI spec
  2. Use `openapi-fetch` library to provide path and parameter type checking
  3. Auto-inject authentication and client identifiers via interceptors
  4. Provide unified error response handling mechanism

- **i18n Language Pack**:
  - For any future added languages (e.g., Japanese, French), if a Key is missing, the system will automatically fallback to the corresponding English translation. If a Key cannot be found in both target language and English, the page will display `[key_name]` instead of blank.
  - Adding new language: Create file in `public/locales/ja/translation.json`, import and add to resources in `src/lib/i18n.ts`, and add 'ja' to the language array in `Navbar.tsx`.
