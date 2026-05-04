# Chain Dev for EVM & Cosmos

Unified development workbench for EVM and Cosmos chain builders.

Website: https://chaindev.net/

## Highlights

- Explore EVM blocks, transactions, accounts, contracts, and pending transactions
- Explore Cosmos blocks, transactions, accounts, validators, proposals, and params
- Switch between EVM and Cosmos providers directly in the browser
- Use browser-side developer workbench features for RPC profiles, private keys, address tags, and contract registry
- Use built-in tools such as:
  - `Signature Lookup`
  - `Wallet Generator`
  - `Bech32`
  - `Keystore`
  - `Hash`
  - `Big Number Calculator`
  - `Unit Converter`
  - `EVM RPC API`
  - `Cosmos REST API`

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- NextAuth
- Drizzle ORM
- SQLite
- `viem`
- `@cosmjs/*`

## Project Structure

- `src/app`: routes, layouts, and API handlers
- `src/platform`: shared product logic, navigation, search, workbench, and tools
- `src/domains`: EVM and Cosmos domain modules
- `src/components`: reusable UI components
- `src/server`: server-side auth and persistence logic
- `src/db`: database client and schema
- `public`: static assets
- `docs`: project documentation

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Copy the example env file

```bash
cp .env.example .env.local
```

3. Update the values in `.env.local`

Minimum variables used by the current app:

- `AUTH_SECRET`
- `DATABASE_URL`

Optional bootstrap variables:

- `BOOTSTRAP_EVM_PROVIDER`
- `BOOTSTRAP_COSMOS_PROVIDER`
- `BOOTSTRAP_PRIVATE_KEY_NAME`
- `BOOTSTRAP_PRIVATE_KEY`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ADMIN_PASSWORD`

4. Start the development server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Available Scripts

- `npm run dev`: start the development server
- `npm run build`: build the production app
- `npm run start`: start the production server
- `npm run lint`: run ESLint
- `npm run typecheck`: run TypeScript type checking

## Notes

- Chain data is fetched directly from the browser by using the active provider.
- The app does not rely on a backend proxy for on-chain RPC or REST reads.
- The workbench is designed to help developers inspect, debug, and operate against EVM and Cosmos chains from one interface.
- SQLite tables are initialized by the application at runtime.
- Legacy reference projects live in `ethereum-tool/` and `cosmos-tool/`. Do not add new code there.

## Documentation

- Chinese overview: `docs/readme-zh.md`
- Self-hosting notes: `docs/self-hosting.md`
- Frontend conventions: `docs/frontend-conventions.md`
