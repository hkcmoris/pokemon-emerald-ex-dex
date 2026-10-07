# Pokémon Emerald EX Dex

A searchable reference for Pokémon Emerald EX 1.0.4 species and forms, stats, types,
learnsets, evolutions, and TM/HM compatibility.

The client fetches data from the SQL-backed `/api/v1` API.
It includes all 1,523 species/form entries, search by name or exact internal species ID
(including `#0001`), type filtering, sorting by ID/name/base stat total/speed, and paginated
results with linked species detail pages. Duplicate names remain separate entries keyed by ROM
species/form ID. Stats are base stats, not calculated battle stats.

Click a species name to see all its imported data: base stats and types, level-up moves,
the full evolution family, related forms and form-change rules, and compatible TMs/HMs. The evolution
line includes every stage and branch, with the viewed species highlighted. Each stage
links to its detail page and preserves every alternative evolution method.
Forms have their own section with sprites, friendly labels and transition summaries.
Mega, Gigantamax, Primal and Ultra Burst forms display their base species' normal
evolution family without treating form changes as evolution edges. ROM names remain
unchanged in SQL and the API. Existing databases need `011_forms.sql`, followed by
`012_import_forms_1.0.4.sql`; see [the forms upgrade](docs/database.md#upgrade-an-already-imported-database-with-forms).
The list shows each species' standard front sprite. Detail pages pair a crisp sprite
with the species name and labeled types. Standard/Shiny changes the appearance; a
separate form selector navigates actual form IDs and keeps the appearance preference.
The four forms without exported sprites show placeholders. Compact base-stat bars
sit above abilities on phones.
On mobile, the Emerald theme puts search above sprite-led Pokémon rows, with the
current comparison value shown for total/speed sorting. Desktop retains the dense
base-stat table. The HeroUI v3 filter sheet offers one type at a time and a sort
order while retaining the visible results during updates. Remove the selected type
chip to clear it, or choose Reset all in the sheet to clear search, type, and sort.
Labeled bottom navigation links Pokémon, Items, and Abilities. A theme control switches
between dark emerald and light mineral surfaces and remembers the choice locally.
Expand move names for descriptions and full move data, or evolution rules for their
conditions and ROM identifiers. Move categories show Physical, Special, and Status
icons alongside their labels in both level-up and TM/HM tables. Category icon filenames
come from `emerald_ex_move_categories.icon_file`; the API serves the PNGs from
`assets/move-categories/`. Import `007_move_category_icons.sql`, then
`008_seed_move_category_icons.sql` to upgrade an existing database. See
[how to replace category icons](docs/database.md#update-move-category-icons).
Types display SQL-backed icons with visible type names in browsing, filtering,
species details, and move tables. Missing icons retain text labels. Import
`009_type_icons.sql`, then `010_seed_type_icons.sql` for an existing database and
deploy `assets/types/` alongside the backend. See
[how to replace type icons](docs/database.md#update-type-icons).
Related species link to their own pages. Detail URLs
such as `#/species/1` can be bookmarked; returning to the list preserves its filters
during the session. JSON exports in `docs/` are import inputs and test fixtures;
neither the client nor the server reads them at runtime.

## SQL database preparation

MySQL/MariaDB schema for an existing shared database, a prepared transactional import
of the five JSON exports and sprite manifest, verification queries, and API query examples are in
`scripts/sql/`. See [database setup and import instructions](docs/database.md).
All dex tables, explicitly named constraints and indexes use the `emerald_ex_` prefix.

For an already imported database, run `scripts/sql/005_species_sprites.sql` followed
by `scripts/sql/006_import_sprites_1.0.4.sql` using an administrative account. This adds
the sprite filenames without replacing existing species, moves or relationships.
Apply the upgrade to both local and production databases before deploying the API
changes. Include `assets/pokemon_emerald_ex_1.0.4_battle_sprites/` with the backend's
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

For Webzdarma PHP 8.4 hosting at `https://devground.cz/pokemon-emerald-ex-dex/`:

```bash
npm run build:webzdarma
```

Upload the contents of `dist/webzdarma/` into the server's
`pokemon-emerald-ex-dex/` directory, including the hidden `.htaccess` files. This
bundle includes the frontend, a PHP 8.4 API, and all PNG assets. On the server,
copy `api/private/config.example.php` to `api/private/config.local.php` and fill
in your production database credentials. No Node process or npm installation is
needed on the hosting server. The API uses the existing `emerald_ex_*` tables;
apply the forms upgrade before deploying this version. Keep `config.local.php` on the server
when uploading future builds. See [the complete FileZilla instructions](docs/webzdarma.md).

The PHP source lives in `apps/server/php/`. The Node backend remains available
for local development and Node hosting; both implementations share the existing
API contract. Client API and image paths use Vite's build base, so the Webzdarma
build uses `/pokemon-emerald-ex-dex/api/` without occupying the domain's root `/api`.

To preview the complete PHP bundle locally with PHP 8.4, `pdo_mysql`, and `mbstring`:

```bash
npm run dev:php
```

This uses your ignored `.env.local` database settings. Set `PHP_BINARY` there if
PHP 8.4 is not on PATH. Open `http://127.0.0.1:3001/pokemon-emerald-ex-dex/`.
Run the explicit read-only PHP/Node parity checks against local MariaDB with
`npm run test:php:db`; this also rebuilds the upload bundle.

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

The SQL-backed item catalog includes all 828 ROM items and native icons, searchable
by name/ID and pocket at `#/items`. Evolution and form panels show linked item sprites
from editable database filenames. Existing databases upgrade with
`scripts/sql/013_items.sql` followed by `014_import_items_1.0.4.sql` after the forms
migrations; see [database setup](docs/database.md) and [Webzdarma deployment](docs/webzdarma.md).

The dex also includes a searchable ability catalog at `#/abilities`. Species
pages display both normal slots and the hidden slot, with links to ROM ability
descriptions and mechanics. For an existing database, import
`scripts/sql/015_abilities.sql`, then `016_import_abilities_1.0.4.sql` before deploying
updated client/PHP files. See [database preparation](docs/database.md) and
[Webzdarma deployment](docs/webzdarma.md).

## Emerald UI design

The interface uses HeroUI v3 Button and Drawer primitives for accessible controls,
keyboard handling, focus management, and scroll locking. Emerald theme variables
live in `apps/client/src/style.css`. DM Sans is bundled locally; its OFL license is
included in `apps/client/src/fonts/OFL.txt`.

- [HeroUI v3 kit copy](https://www.figma.com/design/AVTCKXvpIEiaXA0aa75Qme/HeroUI-Figma-Kit-V3--Community---Copy-)
- [Emerald mobile design draft](https://www.figma.com/design/4YSDZFFh72vPI68B0aScks?node-id=5-2)

The React implementation is verified. The Figma draft uses editable custom components;
linking its controls to the supplied kit and completing supplementary light-mode and
long-name layout fixes are pending because the Figma Starter MCP call limit was reached.
