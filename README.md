# Pokémon Emerald EX Dex

A searchable reference for Pokémon Emerald EX 1.0.4 species and forms, stats, types,
learnsets, evolutions, and TM/HM compatibility.

The client fetches data from the SQL-backed `/api/v1` API.
It includes all 1,523 species/form entries, search by name or exact internal species ID
(including `#0001`), type filtering, sorting by ID/name/base stat total/speed, and paginated
results with linked species detail pages. Duplicate names remain separate entries keyed by ROM
species/form ID. Dex stats are base stats, not calculated battle stats.

Click a species name to see all its imported data: base stats and types, level-up moves,
the full evolution family, related forms and form-change rules, and compatible TMs/HMs.
Details are grouped into Stats, Abilities, Evolutions, and Moves tabs. Stats opens by
default; Evolutions contains both the evolution family and forms. Tabs support keyboard
navigation and retain the selected section when following form or evolution links.
Move descriptions stay visible. Move rows put the type icon before the name and the
category icon after it. Power is prominent on the right, with smaller accuracy, PP,
and priority values below. Rows fit without horizontal scrolling; additional ROM
fields remain available through a muted disclosure below the description. The evolution
line includes every stage and branch, with the viewed species highlighted. Each stage
links to its detail page and preserves every alternative evolution method.
Forms have their own section with sprites, friendly labels and transition summaries.
Mega, Gigantamax, Primal and Ultra Burst forms display their base species' normal
evolution family without treating form changes as evolution edges. ROM names remain
unchanged in SQL and the API. Existing databases need `011_forms.sql`, followed by
`012_import_forms_1.0.4.sql`; see [the forms upgrade](docs/database.md#upgrade-an-already-imported-database-with-forms).
The list shows each species' standard front sprite. Detail pages pair a crisp sprite
with the species name, labeled types, and a counter when multiple forms exist.
Standard/Shiny changes the appearance. Form cards in the Evolutions tab navigate
actual form IDs while keeping the appearance preference.
The four forms without exported sprites show placeholders. Base stats use two columns
with compact labels and highlight every tied highest stat. Beside the total, Physical
or Special SVG icons compare Attack with Sp. Attack; equal values show one combined icon. The
scale explanation remains available under Species data in the Stats tab.
On mobile, the Emerald theme puts search above sprite-led Pokémon rows, with the
base stat total (BST) on the right and the Physical/Special indicator above it; sorting
by speed shows Speed instead. Desktop retains the dense
base-stat table. The HeroUI v3 filter sheet offers one type at a time and a sort
order while retaining the visible results during updates. Remove the selected type
chip to clear it, or choose Reset all in the sheet to clear search, type, and sort.
Labeled navigation links Pokémon, Items, Abilities, My Pokémon, and Simulator. It stays visible
in the header on desktop and mobile. A theme control
switches between dark emerald and light mineral surfaces and remembers the choice locally.
Pagination stays visible at the bottom of the viewport while browsing Pokémon, Items,
and Abilities, with space for the device's safe area on mobile.
The interface uses DM Sans, with monospace reserved for identifiers such as species,
item and ability IDs and TM/HM codes.
The header language selector switches the interface between English and Čeština and
remembers the selection in the browser. Without a saved choice, the interface uses the
first supported language from the browser's preferred languages, including regional
variants such as `cs-CZ` and `en-US`. Czech is the fallback when no supported preference
is available. A saved choice always takes priority. It translates navigation, controls,
field labels, status messages, and type names. Czech type labels appear in the list,
filters, species details, and move tables, including icon tooltips and accessible names.
Type translations are maintained in `apps/client/src/typeNames.ts`; unknown types fall
back to their original names. Database/API values, filter values, and type colours keep
using the original English names. Pokémon, move, item, ability and form names retain
their original wording. Move, item, and ability descriptions use database-backed Czech
translations in Czech mode, with the original English description as fallback.
Evolution summaries, collection condition notes, and level-up recap text also switch
to Czech. Their display translations live in `apps/client/src/evolutionText.ts` and
cover the current dataset's rule templates; unknown future summaries keep their
original wording. In-game names and raw rule details remain unchanged. Switching
languages preserves the current page and filters.

Before deploying this release to an existing database, run
`scripts/sql/018_move_descriptions_cs.sql`, then
`scripts/sql/019_seed_move_descriptions_cs_1.0.4.sql`. The migration adds nullable
`emerald_ex_moves.description_cs`; English `description` remains unchanged. Fresh
installations use the updated `001` schema and `002` import, which already include
the translations. See [Czech move descriptions](docs/database.md#czech-move-descriptions).
For Czech ability and item descriptions, apply `020_ability_item_descriptions_cs.sql`,
then `021_seed_ability_item_descriptions_cs_1.0.4.sql` before deploying. Local development
uses `npm run db:migrate`. See [ability and item translations](docs/database.md#czech-ability-and-item-descriptions).
Expand move names for descriptions and full move data, or evolution rules for their
conditions and ROM identifiers. Move categories show Physical, Special, and Status
icons alongside their labels in both level-up and TM/HM tables. Category icon filenames
come from `emerald_ex_move_categories.icon_file`; the API serves PNGs and SVGs from
`assets/move-categories/`. Physical and Special default to SVGs; Status remains PNG.
For a database already using category icons, deploy the updated API/assets, then
import `017_move_category_svg_icons.sql` to replace only the original
Physical/Special PNG defaults. Custom filenames and
hidden icons remain unchanged. See
[how to replace category icons](docs/database.md#update-move-category-icons).
Types display SQL-backed icons with visible type names in browsing, filtering,
species details, and move tables. Missing icons retain text labels. Import
`009_type_icons.sql`, then `010_seed_type_icons.sql` for an existing database and
deploy `assets/types/` alongside the backend. See
[how to replace type icons](docs/database.md#update-type-icons).
Related species link to their own pages. Detail URLs
such as `#/species/1` can be bookmarked; returning to the list preserves its filters
during the session. Opening a species contracts the list into an independently scrolling
sprite column on desktop, or a horizontal strip on phones. The navigator includes all
matching results in the same search, type filter and sort order, loading further matches
as you scroll in either direction. Switching sprites preserves the selected detail tab.
Expand the list to edit filters or resume browsing at the previous page and scroll position.
Names and species IDs appear on hover or keyboard focus, and reduced-motion settings
skip the transition. Direct detail links start with the unfiltered list; following a form
or evolution outside the active filter leaves that filter unchanged.
JSON exports in `docs/` are import inputs and test fixtures;
neither the client nor the server reads them at runtime.

## Favicons and installation

The supplied emerald SVG is preserved in `apps/client/public/favicon.svg`.
The same artwork supplies the multi-size ICO (16/32/48), PNG browser icons
(16/32/48/96), Apple touch icons (120/152/167/180), Android icons (192/512),
opaque maskable icons (192/512/1024), Safari pinned-tab mask, and Windows tiles.
Apple and maskable icons use the light mineral background; the maskable artwork
has extra padding for system icon shapes.

`apps/client/public/site.webmanifest` provides the Emerald EX app name, standalone
display, theme colours, and installation icons. Relative manifest URLs and Vite's
base-aware HTML links support both root hosting and `/pokemon-emerald-ex-dex/`.
The production offline shell caches these files and refreshes them when their
contents change. The Webzdarma package includes them automatically.

## My Pokémon

Open **My Pokémon** at `#/my-pokemon` to maintain separate named playthroughs, each
with its own collection and an ordered party of up to six Pokémon. The active party
opens first with one member's detail and Stats selected. A persistent party list sits
beside the detail on desktop and becomes a horizontally scrolling strip on mobile.
Switch members directly without leaving the workspace; the selected view stays open.
**Party overview** compares all members' current stats, and **Collection** includes boxed
Pokémon. Add Pokémon from a species detail page or search within the collection.
Only species/form and level are required; nicknames, current moves, and battle stats
are optional. Newly added Pokémon start with up to four distinct moves most recently
learned by their current level in the selected species/form's level-up learnset.
Same-level moves follow dataset order; level-zero special entries are excluded.
Existing Pokémon are unchanged. If the learnset is unavailable offline, moves remain
unrecorded. Multiple owned Pokémon of the same species remain separate individuals.
Removing a party member keeps it in the collection. **Release from collection** in
each card's footer removes the Pokémon from both the collection and its party.
Released Pokémon remain recoverable under **Removed entries** and return to the
collection when restored. Removed playthroughs and stat observations can also be restored.

Owned species and their moves use type icons and type-tinted surfaces, including
move selection, upcoming moves, and level-up recaps. Owned Pokémon headers show the
physical, special, or balanced category icon beside their types, based on the species'
base Attack and Sp. Attack, matching the Pokédex indicator. Current moves form a compact
2×2 grid with category icons and power; moves without fixed base power show an em dash.
A larger **Effective power** value above base power compares each move using its
power × the individual's current recorded Attack or Sp. Atk × ordinary STAB (1.5
for a matching type, otherwise 1). Tap the number for its explanation. Missing or
conflicting current stats and moves without a supported fixed-power calculation
show a dash. This is a comparison score, not HP damage against an opponent; see
[the formula, exceptions and research sources](docs/move-power.md).
Owned cards and detail pages also show automatic **Battle strength** from 0–100.
Expand the score for Stats, Moves and Typing contributions, estimated-stat labels,
and unsupported moves. The score uses the current form, level and moves, including
accuracy, STAB, coverage, reviewed support moves, and the severity of weaknesses,
resistances and immunities. Missing stats use labeled estimates; unknown moves or
conflicting records prevent an overall score. Collection sorting can put the
highest scores first without changing the saved party order. Cached reference data
supports offline scoring. Abilities, items and temporary battle effects are excluded;
see [the scoring formula and limits](docs/battle-strength-score.md).
Open **Simulator** from the main navigation, or **Simulate damage** on an owned Pokémon,
to compare its attacks against any opponent species/form and level. The main entry
uses the current playthrough and remembered member, falling back to its first party
member or collection Pokémon. The simulator shows the attacker's back sprite,
HP damage ranges, enemy HP percentages, STAB and type matchups. Compact sprite strips
for your party and the saved enemy party sit above the matchup, so either side can
be switched without scrolling through management controls. Selected members are marked;
known enemy move weaknesses and sync conflicts retain warning icons. Current move cards
sit directly below the matchup. **Edit battle stats** starts collapsed. Detailed encounter
and party information, collection selection, scenario reset, and saved-level controls sit
beside the battle on desktop and below it on phones, with phone shortcuts between the
battle and team controls. Enemy stats assume
neutral nature, 31 IVs and 0 EVs, with temporary HP and offensive/defensive stat overrides.
Preview the current form's full learnset and TM/HM moves, including future level
labels and recorded inherited moves. Save named enemy encounters with up to six opponents,
switch between them in one click, and record up to four revealed moves per opponent.
Levels and moves autosave and sync with the signed-in collection; duplicate an encounter
for a rematch while retaining the original. Known super-effective enemy moves add an
expandable warning to each vulnerable party member. The selected matchup also shows
estimated incoming HP damage, using current measured defenses when available and clearly
labeled estimates otherwise. Unknown moves remain unknown. Quick matchups, stat overrides
and move previews stay temporary; resetting the scenario keeps saved encounters.
See [the simulator's formula and limits](docs/features/damage-simulator.md).
Each collection Pokémon has a saved **Nature** selection and, when its current form
has multiple distinct abilities, an **Ability** selection including hidden abilities.
Unknown remains a valid choice. A form with one ability displays it directly.
Nature-boosted current stats use red text and an up arrow; lowered stats use blue
text and a down arrow. Neutral natures and HP stay unchanged. Recorded stat values
already include nature, so choosing one never multiplies or rewrites observations.
The choices sync with the collection; a form change requires selecting an ability
for that form again. The simulator displays these traits and colors its attacker
stat inputs, but still excludes ability effects from damage. Historical stat records
keep their original values without retroactively assigning the current nature.
Nature IDs and the +10%/−10% mapping follow the
[upstream nature table](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/pokemon.c#L351-L406).

Category and power also appear in **Coming up**, saved wishes, wishlist choices,
and learning-plan steps. Missing reference data shows a question mark.
SVG effect icons beside move names summarize status conditions, stat changes, healing,
drain, and recoil in move cards, wishlist choices, and species move tables. Hover, focus,
or tap an icon to show its explanation; tap elsewhere or press Escape to dismiss it.
The hints identify the affected side and possible or conditional effects; no secondary-effect
percentages are inferred. Opening a hint never selects or removes a move.
The audited Emerald EX 1.0.4 mapping and its limits are described in [Move effects](docs/move-effects.md).
Matching physical/special moves have a gently pulsing border, using the same base Attack
versus Sp. Attack comparison as the Pokémon's category icon. Equal stats highlight both
damaging categories; status moves are excluded. Reduced-motion preferences keep a static border.
Unused move slots have dashed borders and 45° stripes, keeping the move grid the same
height for zero to four moves. Unrecorded moves retain an explicit unknown label.
A shared four-button selector switches all party and collection cards between current
**Moves**, **Stats**, **History**, and **Matchups** (weaknesses and resistances together). The selector
and **Record stats** stay pinned below the header (and mobile party strip), so they
remain available while scrolling through a member's details. The selected view stays
the same when switching between members, party, and collection. Each view grows
the card vertically as needed, with wrapping type badges and no fixed-height overlay.
The graph legend sits in a single column on the right, leaving more vertical room for the plot.
Measurements at the same level connect in recorded-time order, so a stat increase
without a level-up appears as a vertical step. Both observations remain in history.
Missing values, conflicting readings at the same timestamp, and changes of form
still break the affected lines.
Hover near a chart point, tap it, or focus it with the keyboard to show its recorded value
and level above the point. Tapped hints stay visible until another point is selected,
you tap elsewhere, or press Escape; Enter and Space also keep a focused hint open.
Upcoming milestones remain below every view. Type defenses use the seeded 18-type chart
from `024_type_effectiveness.sql` and `025_seed_type_effectiveness.sql` through
`GET /api/v1/type-effectiveness` on both Node and PHP. Dual types multiply: Water/Ground
takes 4× Grass damage, Bug/Poison takes ¼×, and an immunity keeps the result at 0×.
The view excludes neutral damage and accounts for typing only, not abilities, held items,
or battle effects. The chart is cached per dataset for offline use after its first load;
missing or unknown matchup data is shown as unavailable.
Type names remain available
when icons are missing; saved move names remain visible when reference data is
unavailable offline.

**Record stats** opens the entry form from any view. Saving a higher level in Stats or History
also opens stat entry at the new level; an unfinished entry keeps its original level and values.
Lowering the level does not open an entry. **Save & next member** saves and opens
entry for the next party member; **Save & add another** keeps recording the same member,
including repeated measurements at the same level. **Use last observed values** explicitly
copies unambiguous values for the selected form and level; changed stats show their deltas.
Predictions from two earlier levels prefill supported fields and remain labeled as estimates.
Check them against the game before saving; saving records the displayed values as observations.
Untouched predictions follow the selected level, while edited or explicitly cleared fields
stay as entered, including after reloading. Unsupported values remain blank. Corrections,
historical forms and entries with unresolved conflicts do not receive prediction prefills.

Unfinished observations and move choices are stored on this device and survive navigation
and reloads. A roster badge identifies unfinished stats and pending decisions. Cancel
explicitly discards a normal entry. Drafts are separate from saved history and do not sync.
Use **Observed form** for an earlier evolution stage when transcribing older screenshots;
this does not change the current species or lower its level. Saving a new current-form
observation above the current level advances the level in the same save. Corrections and
historical-stage observations never advance the current level.

**Record from screenshots** opens a queue for the playthrough. Import or paste images,
assign each to a member, and transcribe it beside the entry form. Each item retains its own
form, level, timestamp, and draft. Saving advances to the next image without assuming a
level-up. Completed screenshots stay in a local archive; images are not uploaded or synced.
Stable observation identities make retrying a queue save safe if archiving was interrupted.

Party members and current moves have dedicated drag handles. Drag to reorder, use the
position selector, or focus a handle and press Space, arrow keys, then Enter; Escape cancels.
The order saves on drop with Undo and Retry. Selection stays on the same member. Undo
changes only the order, preserving newly recorded stats. On mobile, dragging the handle
reorders while the rest of the party strip remains scrollable.

Each move slot has **Replace**; **Add move** fills a free slot. Choosing the candidate saves
immediately with Undo. Candidates prioritize newly reached and wanted moves and label
future levels, other forms, and machine requirements. Wishlist and level-up prompts can
learn a move directly: one action with a free slot, or choose the slot to replace when full.
Move choices survive switching members and reloads; stale choices require review before saving.

Levels and evolutions can also be updated manually. Actionable level-up decisions remain
attached to the member until **Done reviewing**, including after navigation and reloads.
A level increase without opportunities gets a short saved confirmation. Record an evolution
from **Coming up**, the recap, or **Pokémon details**, then confirm what happened in-game.
Earlier observations retain their original form and current moves stay unchanged.
Long evolution comparisons and metadata are collapsed; Stats shows measured values, deltas,
the chart and recent correctable observations, with full history one tab away.
The overview provides quick recording actions without duplicating full cards.
On phones, branding collapses while scrolling and the roster compacts further during entry.
Workspace tabs, scroll position, simulator opponent settings and move previews survive
navigation during the current browser session. New measured attacker data invalidates stale
simulator overrides; **Reset scenario** clears the working scenario explicitly.

Partial stat observations retain their measurement time, level, and species/form.
The measurement date field fits the form width on mobile, including iOS, while retaining
the native date and time picker.
Corrections update the original observation. Optional estimates interpolate only
between unambiguous recorded values within the same continuous form period; they
never cross an evolution/form change or predict future levels.

Party and collection cards show identity, level controls, current moves, and just the next
two milestones in one row. Level-up moves and evolutions share the same chronological
list; evolutions use the DNA icon. Moves marked with raw level 0 follow their evolution with an
“On evolution” badge. Torchic therefore shows Combusken and Double Kick together at level 14,
when its next planned evolution is at level 16, including with an active wishlist.
Reached evolution levels stay visible until the species
is updated, while evolutions without a known level follow level-based milestones.
Click a card or focus its name link to open that owned Pokémon at `#/my-pokemon/<id>`.
The detail page contains evolution comparisons, nickname and form editing, growth history,
and party/release controls. Back returns to the collection; missing or removed records
show a not-found message. Level and move controls on the compact card remain independent
of its detail link. Detailed guidance compares full future evolution paths. Guidance covers level-up and TM/HM data only; tutors and move
reminders are excluded. Separate highlights show moves to learn before leaving a
stage and new level-up moves gained by evolving. Shared moves stay in the timing
comparison, while TM/HM alternatives remain visible beside level-up differences.
For example, Torchic's level-46 Flamethrower is highlighted with the evolved forms'
TM35 alternative. Delaying evolution can pass the learning levels of newly unlocked
moves. The comparison does not claim permanent loss. Entries
whose learning level has passed are not presented as future opportunities. Raw
level-zero entries are evolution moves, following the upstream engine’s learnset convention.
They remain available when evolution is delayed. Level-1 entries alone do not indicate
evolution learning. The species page labels raw level 0 as “On evolution” and preserves
the raw value under additional data. Evolution
conditions use recorded moves, party members, and measured stats where available;
unknown requirements still need checking in the game. Plain level-only evolutions
use one concise line, such as “→ Combusken — evolves at level 16.”, without repeating
the level as a recorded-data status. Rules with additional conditions keep their details.
Detailed move comparisons follow the selected English or Czech UI language, including
learning deadlines, special level-zero entries, and TM/HM availability notes.
Pokémon, move, and machine names retain their in-game spelling.

### Move wishlists

Each owned Pokémon has a **Wanted moves** wishlist, hidden by default even when
it contains saved wishes. Open or close it with the wish icon beside **Edit** in
**Current moves**, on a collection card or its detail page. Select any number of
moves from its evolution family, and choose the final evolution when the family
branches. The planner starts at the recorded form and level, compares all wishes
together, and shows an ordered learn/evolve timeline. Level-zero evolution moves are
learned immediately after the corresponding evolution. It prefers natural level-up
learning; a TM/HM route is clearly conditional on obtaining the machine. Blocked
choices explain the timing or branch conflict and name the conflicting wishes.
The wish buttons in **Learn before evolving**, **New moves after evolving**,
and **Coming up** add moves directly using the same checks; a checkmark means the
move is already tracked, and clicking it removes the wish. **Coming up** follows
the wishlist's evolution schedule and explains when to wait, including required
moves and conditional TM/HM access. It pauses evolution advice when a wishlist
plan cannot be confirmed, rather than suggesting the species' minimum level.
Desktop collection cards keep a compact plan note beside the **Coming up** heading;
open it for the full explanation without changing card height. Mobile and detail
pages show the full note inline.

Recording a wanted move among **Current moves** completes that wish automatically.
Completion remains saved after replacing the move, evolving, or removing and later
re-adding the wish. The app trusts the recorded current moves, including the initial
suggested moves; correct those if they do not match your game. Changing levels,
forms, targets, or wishes recalculates the plan. Missed goals remain visible for
review rather than being silently deleted. Wishlist choices and learned history
use the same browser persistence and account sync as the Pokémon; divergent
wishlist edits require an explicit sync-conflict choice. Existing collections need
no data migration; deploy the updated client and Node/PHP API validators together.

**Move Reminder alternatives remain disabled.** The creator's available sources
do not establish the exact Emerald EX 1.0.4 rules. See the
[verification evidence and enabling criteria](docs/move-reminder-rules.md).
Evolution moves use the raw level-zero marker for every species, without a per-species
allowlist. A duplicate at level 1 does not create a relearning route. Ordinary level-up
learning at the exact evolution level remains outside the planner’s supported routes.
A “no verified route” result refers to the supported planning
rules, not a claim that all in-game acquisition methods are impossible. Missing
reference data pauses confirmation of a plan; saved wishes remain accessible.

Guest use starts without registration. Collections are saved in browser storage.
In production builds, a service worker makes the app reopen offline after a successful
first visit; previously loaded collection reference data remains available, while
uncached dex searches and guidance need a connection. Google sign-in is optional and
only authenticates the player: collection data is stored in **this app's MySQL
database**, not on Google. Sign in once on each device to connect it. Guest
playthroughs upload automatically as separate runs, even when names match. Compatible
offline changes merge automatically; conflicting values, removals, or party lineups
show both alternatives for an explicit choice. Pending edits sync while the app is
open and connected, and signing out keeps account data separate from guest data.
The sync status shares one compact row with the expandable account controls.
This panel sits beside the page heading on desktop and below it on smaller screens.

Google sign-in still needs deployment configuration: apply
`scripts/sql/022_my_pokemon.sql`, create a Google OAuth Web client, and configure its
public client ID, allowed origins, and secure production cookies. No live client ID
is included. Local collections work without it. Follow
[Google sign-in and sync setup](docs/my-pokemon-sync.md) for Node and PHP/Webzdarma;
the [feature brief](docs/features/my-pokemon.md) records the accepted behavior.

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

- Node.js
- TypeScript
- npm
- React + Tailwind CSS + Vite

## Requirements

- Node.js version from `.nvmrc`
- npm version from `package.json`

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

Apply missing incremental upgrades to the imported local database:

```bash
npm run db:migrate
```

Use a local administrative database account. The command records completed upgrades
and skips them on subsequent runs. See [local migrations](docs/database.md#local-migrations)
for initial imports and adoption of databases previously upgraded by hand.

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

Species details, abilities, items, My Pokémon, and the damage simulator load as
separate JavaScript chunks when opened, with a localized loading message while a
page loads. Shared styles load with the app. The production service worker
precaches all emitted chunks so those pages remain available after offline setup.

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

Formatting and ESLint skip the exported battle sprite directory, including its manifest.
Regular tests skip the full sprite PNG scan. Run it separately when needed:

```bash
npm run test:sprites
```

Run the standard project checks with:

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

Species headers, mobile Pokémon cards, desktop Pokémon rows, and move rows use a
Mica-inspired opaque surface with broad type tints, a soft sheen, and subtle inset
edge highlights. Move rows use the move’s own type, including level-up moves and
TM/HM compatibility.
Type colors supply the tint; text tones adapt to the light and dark themes.

Every move display uses `apps/client/src/MoveDisplay.tsx`: Pokédex learnsets,
collection moves and learning plans, pickers, revealed enemy moves, party guidance,
and both directions of simulated damage. `size="small"` provides a compact chip,
`medium` provides a collection card, and `large` provides a detailed card. All sizes
wrap long names and adapt their spacing on phones. The `show` options independently
control type, category, effects, description, power, accuracy, PP, priority, and the
individual comparison score. Contextual metadata, actions, and calculation details
use the component's slots; they do not introduce separate move-card layouts.
Cards with a contextual result put the move beside the damage range and HP percentage.
Simulator cards show base power, accuracy, and base PP together in a compact stats group.
Current moves stay in a two-by-two grid on desktop and phones, with damage prominent
and calculations expandable below. Learning sources for recorded moves are inside
the calculation disclosure; temporary previews retain their source badges.

Pass a full `Move` or a `KnownMove` plus its resolved `reference`. `MyPokemonMove`
is a collection data adapter for the same display. Calculations stay with their
feature: the optional `metric` displays total HP damage separately from base power,
while the labeled comparison score keeps its explanatory tooltip. Use `interaction`
for a selectable move or checkbox; effect and score controls remain separate from
that action. Use `passive` inside an existing link or button to avoid nested controls.

Species detail headings receive focus after navigation for screen readers, without
a visible outline. Interactive controls retain their keyboard focus indicators.
The appearance toggle sits directly below the sprite. Either button switches between
standard and shiny, including the selected button; both are disabled when no shiny
sprite is available.

- [HeroUI v3 kit copy](https://www.figma.com/design/AVTCKXvpIEiaXA0aa75Qme/HeroUI-Figma-Kit-V3--Community---Copy-)
- [Emerald mobile design draft](https://www.figma.com/design/4YSDZFFh72vPI68B0aScks?node-id=5-2)

The React implementation is verified. The Figma draft uses editable custom components;
linking its controls to the supplied kit and completing supplementary light-mode and
long-name layout fixes are pending because the Figma Starter MCP call limit was reached.
