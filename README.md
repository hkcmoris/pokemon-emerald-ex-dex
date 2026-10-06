# Pokémon Emerald EX Dex

A searchable reference for Pokémon Emerald EX 1.0.4 species and forms, types, and base stats.

The client imports `docs/pokemon_emerald_ex_1.0.4_stats_types.json` directly at build time.
It includes all 1,523 species/form entries, search by name or exact internal species ID
(including `#0001`), type filtering, sorting by ID/name/base stat total/speed, and paginated
results with a stat detail panel. Duplicate names remain separate entries keyed by ROM
species/form ID. Stats are base stats, not calculated battle stats.

The learnset, evolution, and TM/HM exports in `docs/` are not yet displayed.

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

```bash
npm run dev:client
```

Open the Vite URL printed in the terminal. The dex does not require the backend or a database.
Use `npm run dev:server` to run the backend separately.

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Full check

```bash
npm run check
```

## Environment variables

Copy `.env.example` to `.env` and fill in the required values.

```bash
cp .env.example .env
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
