# Emerald EX Pokédex

A mobile-first reference for Pokémon Emerald EX 1.0.4. Search 1,523 ROM species and forms by name or ID, then inspect ordered level-up moves, TM/HM compatibility and complete evolution families.

## Tech stack

* React, TypeScript, Vite and Tailwind CSS
* Express API with Node's built-in SQLite for local and conventional Node hosting
* Cloudflare Worker API and managed D1 SQL database for Sites hosting
* Shared API contracts and prepared SQL queries; no additional production dependencies

## Requirements

* Node.js 22.18 or newer, within the range in `package.json`
* npm 10 or newer

## Setup

```bash
npm install
npm run db:import
```

## Development

```bash
npm run dev
```

This builds the shared package and starts both the API on port 3000 and Vite on port 5173. Open `http://localhost:5173`. Vite proxies `/api` to the local server. `npm run dev:server` and `npm run dev:client` run them separately.

## Build

```bash
npm run build
npm start
```

Open `http://localhost:3000`. The Node server serves both the compiled client and the API. SQLite imports automatically on first startup. Set `DATABASE_PATH` to a persistent disk location when deploying to a Node host; retain `docs/` for the initial import. Build output and database files are ignored by Git.

## SQL data import

The three original JSON exports in `docs/` are import inputs. They are not loaded by the frontend, and normal API queries read the SQL database.

The importer preserves all 1,523 species/form IDs, 935 moves, 23,729 ordered learnset rows, 58 machines, 32,358 compatibility pairs and 644 evolution rules. Seven relational tables hold species, moves, learnsets, machines, compatibility, evolutions and dataset metadata. Learnsets use `(species_id, position)` as their primary key so identical source rows survive. Evolution conditions and original fields are retained as JSON within each SQL evolution record.

`npm run db:import` is idempotent and refreshes normalized search names. Import runs in a transaction with foreign-key checks. ROM species IDs are identities, not assumed National Pokédex numbers. Duplicate names remain separate forms, and the UI labels them by ROM ID. The 26 internal form-routing rules are stored but excluded from ordinary evolution chains.

## API

* `GET /api/health` — server health
* `GET /api/metadata` — game version and database counts
* `GET /api/pokemon?search=pikachu&page=1&pageSize=36&sort=id` — paginated search; `sort=name` is also supported
* `GET /api/pokemon/25` — species, ordered learnset, compatible machines and complete ordinary evolution family

Search ignores case and accents, accepts straight/curly apostrophes, and supports padded IDs such as `0025` or `#0025`. User search values are bound SQL parameters; wildcard characters are treated literally. Page size is limited to 100. Invalid parameters return 400, missing species return 404, and unsupported API methods return 405.

## Hosted deployment

The Site identity and logical D1 binding are in `.openai/hosting.json`. To prepare the production artifact:

```bash
npm run check
npm run build:hosted
```

The build emits `dist/server/index.js`, `dist/client/` and deployment metadata. Sites applies the generated schema-only migrations in `drizzle/` before uploading the Worker. On the first data request, the Worker imports the trusted dataset through one atomic, idempotent D1 batch. Seed statements are embedded in the server bundle; the client fetches only the API results it needs. Import failures return a recoverable 503 and retry on the next request.

Schema definitions are in `db/schema.ts`; `npm run db:generate` creates Drizzle migrations. The native schema in `apps/server/src/db/schema.ts` must remain equivalent. Drizzle and esbuild are development-only build tools. Never rewrite applied migrations or put seed data in migrations. Publishing uses the Sites plugin workflow against the saved Site identity.

## Test

```bash
npm test
```

## Full check

```bash
npm run check
```

## Environment variables

Copy `.env.example` to `.env` if overrides are needed. Defaults work without credentials. `PORT` defaults to 3000, `LOG_LEVEL` to `info`, and `DATABASE_PATH` to `data/pokedex.sqlite`, resolved from the repository root. D1 is supplied by the hosted runtime's `DB` binding.

```bash
Copy-Item .env.example .env
```

## Project structure

```txt
apps/client/      Vite + React frontend
apps/server/      Node.js backend/service
packages/shared/  Shared types/utilities
scripts/          Project automation scripts
db/               Hosted SQL schema definitions
drizzle/          Generated schema-only migrations and metadata
docs/             Project notes and architecture decisions
.github/          GitHub Actions and dependency automation
```

## Notes

Pixel artwork is illustrative and comes from Pokémon Showdown. Unavailable sprites fall back to a Poké Ball; ambiguous ROM forms use their exported display name. The supplied exports do not include Pokémon types, stats, move power/accuracy, egg moves or tutors, so these are not invented. Source spellings and evolution-condition summaries are preserved. Pokémon is owned by Nintendo, Game Freak and Creatures; this is an unofficial fan reference.

Tests verify every species' ordered learnset and machine compatibility against the source exports, complete evolution preservation, idempotent import, foreign keys, special compatibility cases, API validation and hosted schema/seed execution.
