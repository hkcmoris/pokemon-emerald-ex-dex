# Pokémon Emerald EX Dex

A searchable reference for Pokémon Emerald EX 1.0.4 species and forms, stats, types,
learnsets, evolutions, and TM/HM compatibility.

The client fetches data from the SQL-backed `/api/v1` API.
It includes all 1,523 species/form entries, search by name or exact internal species ID
(including `#0001`), type filtering, sorting by ID/name/base stat total/speed, and paginated
results with linked species detail pages. Duplicate names remain separate entries keyed by ROM
species/form ID. Stats are base stats, not calculated battle stats.

Click a species name to see all its imported data: base stats and types, level-up moves,
incoming and outgoing evolution rules, internal form changes, and compatible TMs/HMs.
The list shows each species' standard front sprite; detail pages show standard and
shiny front sprites. The four forms without exported sprites show placeholders.
On mobile, a compact header and side-by-side type/sort filters leave room for the
initial species rows without scrolling.
Expand move names for descriptions and full move data, or evolution rules for their
conditions and ROM identifiers. Move categories show Physical, Special, and Status
icons alongside their labels in both level-up and TM/HM tables.
Related species link to their own pages. Detail URLs
such as `#/species/1` can be bookmarked; returning to the list preserves its filters
during the session. JSON exports in `docs/` are import inputs and test fixtures;
neither the client nor the server reads them at runtime.

## SQL database preparation

MySQL/MariaDB schema for an existing shared database, a prepared transactional import
of the four JSON exports and sprite manifest, verification queries, and API query examples are in
`scripts/sql/`. See [database setup and import instructions](docs/database.md).
All dex tables, explicitly named constraints and indexes use the `emerald_ex_` prefix.

For an already imported database, run `scripts/sql/005_species_sprites.sql` followed
by `scripts/sql/006_import_sprites_1.0.4.sql` using an administrative account. This adds
the sprite filenames without replacing existing species, moves or relationships.
Apply the upgrade to both local and production databases before deploying the API
changes. Include `docs/pokemon_emerald_ex_1.0.4_battle_sprites/` with the backend's
deployment files so it can serve the PNGs. See the database and deployment docs below.

Regenerate the import after changing the source exports:

```bash
npm run db:generate-import
```

The API reads these prefixed tables in the database selected by its configuration.
See [API endpoints and deployment](docs/api.md).

## Tech stack

* Node.js
* TypeScript
* npm
* React + Tailwind CSS + Vite

## Requirements

* Node.js version from `.nvmrc`
* npm version from `package.json`

## Setup

```bash
npm install
```

## Development

Import the schema and data into local MariaDB using the [database instructions](docs/database.md).
Create `.env.local` in the repository root with your local configuration:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=emerald_ex_dev
DB_USER=root
DB_PASS=your_local_password
DEX_DATASET_ID=emerald-ex-1.0.4
```

Keep credentials in this ignored file. `.env.local` takes precedence over `.env` during
development; process environment variables take precedence over both. Production
(`NODE_ENV=production`) ignores `.env.local`.

Build the shared package and start the backend in one terminal:

```bash
npm run build -w packages/shared
npm run dev:server
```

Start the client in a second terminal:

```bash
npm run dev:client
```

Open the Vite URL printed in the terminal. Vite forwards `/api` requests to
`http://127.0.0.1:3000`; set `DEV_API_TARGET` in `.env.local` if the backend uses a
different address. The backend checks the configured dataset at startup and closes
its database pool on shutdown.

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

Run the read-only integration tests against your imported local database:

```bash
npm run test:db
```

These require local database credentials and the original 1.0.4 import. They refuse
a remote `DB_HOST`. Regular `npm run check` does not require a running database.

## Full check

```bash
npm run check
```

## Environment variables

For a new local setup, copy `.env.example` to `.env.local` and fill in your local
database credentials. Keep production configuration in `.env` or process environment
variables. See [configuration and deployment](docs/api.md).

```bash
cp .env.example .env.local
```

## Project structure

```txt
apps/client/      Vite + React frontend
apps/server/      Node.js backend/service
packages/shared/  Shared types/utilities
scripts/          Project automation scripts
docs/             Project notes and architecture decisions
.github/          GitHub Actions and dependency automation
```

## Notes

Important project-specific decisions, limitations, or deployment notes go here.
