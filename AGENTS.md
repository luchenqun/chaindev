# Repository Guidelines

## Project Structure & Module Organization

This repository is a Next.js App Router project. Main application code lives in `src/`.

- `src/app`: routes, layouts, and API handlers
- `src/components`: reusable UI primitives
- `src/domains`: EVM and Cosmos domain queries, formatters, and UI blocks
- `src/platform`: navigation, search, workbench, and shared product logic
- `src/server`: server-side repositories, auth helpers, and response utilities
- `src/db`: Drizzle schema and database client
- `public`: static assets such as brand SVGs and icons
- `docs`: project and deployment documentation

Legacy reference projects exist in `ethereum-tool/` and `cosmos-tool/`; do not add new code there.

## Build, Test, and Development Commands

- `npm run dev`: start the local Next.js dev server
- `npm run build`: create a production build
- `npm run start`: run the production server
- `npm run lint`: run ESLint on app and config files
- `npm run typecheck`: run TypeScript without emitting files
- `npm run db:generate`: generate Drizzle migration artifacts

Run `npm run typecheck` and `npm run build` before pushing to `main`.

## Agent Workflow Notes

- Do not run `npm run typecheck` by default after every small change. Prefer running it only before `push`, before a PR, or when the user explicitly asks for verification.
- Do not delete `.next` unless the user explicitly approves it. Removing `.next` while `npm run dev` is running can break the active local dev server.
- Avoid disruptive cleanup actions during active local development. If cache cleanup is truly needed, explain the impact first and let the user restart the dev server on purpose.
- Do not store any blockchain data on the server. All chain data must be fetched from the client, and cached in IndexedDB only when it is actually useful for UX or performance.
- Do not design or add server-side persistence, snapshots, or indexing for chain state, blocks, transactions, validators, proposals, or similar on-chain data unless the user explicitly changes this rule.
- For chain queries and chain data decoding, prefer direct client-side RPC/REST requests. Do not add backend proxy or server-side decode routes for on-chain reads unless the user explicitly asks for that architecture.

## Coding Style & Naming Conventions

Use TypeScript and ES module syntax only. Prefer named exports unless a framework convention requires default export.

- Components: `PascalCase`
- Hooks and helpers: `camelCase`
- Route folders: lowercase, Next.js-style
- Shared UI should stay in `src/components`; feature-specific UI belongs under `src/domains`

Styling is Tailwind-based. Prefer shadcn-style primitives for selects, dropdowns, and similar controls instead of custom native dropdown styling.

By default, place action buttons aligned to the right in toolbars, card headers, form footers,
and similar action areas unless a specific screen clearly requires another layout.

For table action columns that use icon-only controls, keep icons tightly grouped with zero gap
between items, use a compact `3px` visual padding per icon button, and provide an immediate
hover label with a custom tooltip instead of relying on the browser's delayed native `title`.

By default, data tables should keep cell content on a single line. Do not wrap values like
ages, amounts, addresses, or gas labels onto multiple lines. When a table becomes wider than
its container, prefer horizontal scrolling over text wrapping.

## Testing Guidelines

There is no automated test suite in the first version yet. Until one is introduced, use:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

When tests are added, place them near the relevant module or under a dedicated test directory with clear `*.test.ts` or `*.test.tsx` naming.

## Database Notes

Do not treat database migrations as a blocker for routine feature work in this repository at the current stage. Update Drizzle schema files when needed, but do not spend time designing or validating migration workflows unless the task explicitly asks for it.

## Commit & Push Guidelines

Follow Conventional Commits in English, for example:

- `feat: add rpc provider selector`
- `fix: remove default cosmos rpc fallback`

This project does not use pull requests. Push changes directly to `main`.

Before pushing to `main`, include the key verification commands you ran in your handoff or task notes when relevant.
