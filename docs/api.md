# SQL-backed dex API

The Express backend reads the existing `emerald_ex_` tables using the MariaDB Node.js
driver. Queries bind the configured `DEX_DATASET_ID` and all user values as parameters;
sort expressions come from a fixed allowlist. There is no JSON-file fallback.

## Configuration

Use `.env.local` at the repository root for development. The backend loads it before
`.env`, while process environment variables retain highest precedence. With
`NODE_ENV=production`, only `.env` and the process environment are used.

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Backend HTTP port | `3000` |
| `DB_HOST` | Database host | Required |
| `DB_PORT` | Database port | `3306` |
| `DB_NAME` | Existing database containing the prefixed tables | Required |
| `DB_USER` | Database account | Required |
| `DB_PASS` | Database password | Empty |
| `DEX_DATASET_ID` | Dataset used by every endpoint | `emerald-ex-1.0.4` |
| `DEV_API_TARGET` | Vite dev/preview proxy target | `http://127.0.0.1:3000` |

The API only issues SELECT queries. Its production database account needs SELECT on
the 14 dex tables. Apply schema/import scripts separately with an administrative
account. The backend uses a pool of at most five connections and checks that the
configured dataset exists before listening. Connections and queries have timeouts;
the pool closes when the process receives SIGINT or SIGTERM.

## Endpoints

These GET endpoints are public reads and do not require authentication. There are no
write endpoints. Configure request limits at the production reverse proxy if needed.

| Endpoint | Data |
| --- | --- |
| `/api/health` | Existing `{ "ok": true }` process health response |
| `/api/v1/dataset` | Dataset ID, game, version and species/form count from SQL |
| `/api/v1/types` | Complete ROM type catalog with `typeId`, `name`, and `iconFile`, sorted by name |
| `/api/v1/species` | Paginated species with stats and ordered type names/IDs |
| `/api/v1/species/:id` | One species/form with stats and types |
| `/api/v1/species/:id/details` | Species, complete learnset, full TM/HM move records, and incoming/outgoing evolution rules including internal form markers |
| `/api/v1/species/:id/name` | `{ name }` |
| `/api/v1/species/:id/stats` | Six stats and `baseStatTotal` |
| `/api/v1/species/:id/types` | Ordered `{ typeId, name, iconFile, slot }` records |
| `/api/v1/species/:id/sprites` | Standard/shiny front/back filenames, optional second frames, frame count and missing-sprite reason |
| `/api/v1/species/:id/learnset` | Ordered level-up entries with full move records |
| `/api/v1/species/:id/evolution` | Outgoing evolution rules, excluding internal routing markers |
| `/api/v1/species/:id/machines` | TM/HM compatibility records |
| `/api/v1/moves` | Paginated moves, ordered by internal move ID |
| `/api/v1/moves/:id` | Full move record including description and engine IDs |
| `/api/v1/moves/:id/name` | `{ name }` |
| `/api/v1/moves/:id/category` | `{ categoryId, name, iconFile }` |
| `/api/v1/moves/:id/pp` | `{ pp }` |
| `/api/v1/moves/:id/type` | `{ typeId, name, iconFile }` |
| `/api/v1/moves/:id/power` | `{ power, effectId }` |
| `/api/v1/moves/:id/damage` | Alias of `/power`; base power, not calculated battle damage |

Success responses use `{ "data": ... }`, except for the existing health response.
Species IDs are internal ROM IDs in the range 1–65535; move IDs allow 0–65535,
including sentinel move 0. Padded IDs such as `0001` are accepted. Unknown IDs and
endpoints return 404. Invalid parameters return 400. Existing species with no
learnset/evolution/machines return an empty array. Error responses use
`{ "error": { "code": "...", "message": "..." } }`; unexpected failures return 500
without SQL or connection details. `/api/health` reports process health, while
`/api/v1/dataset` exercises the database connection.

## Lists and filters

`/species` accepts `q`, `type`, `sort`, `page`, and `pageSize`:

- `q`: case-insensitive literal name substring or exact numeric species ID, optionally
  starting with `#`; trimmed, at most 100 characters. SQL wildcard characters are literal.
- `type`: type name, matching either slot; at most 32 characters.
- `sort`: `id` (default), `name`, `total`, or `speed`. Stats sort descending, names and
  IDs ascending. Equal names/stats sort by ascending species ID.
- `page`: positive integer, default 1, maximum 65535.
- `pageSize`: integer 1–250, default 40.

`/moves` accepts `q` for literal name search and the same pagination parameters.
Unknown list query parameters return 400. An out-of-range page returns an empty data
array with the requested page metadata.

Example: `/api/v1/species?q=Bulbasaur&page=1&pageSize=40`

```json
{
  "data": [
    {
      "speciesId": 1,
      "name": "Bulbasaur",
      "types": ["Grass", "Poison"],
      "typeIds": [12, 3],
      "typeIconFiles": ["48px-Grass.png", "Poison.png"],
      "stats": { "hp": 45, "attack": 49, "defense": 49, "spAttack": 65, "spDefense": 65, "speed": 45 },
      "baseStatTotal": 318,
      "sprites": {
        "front": "front/0001_Bulbasaur.png",
        "shinyFront": "shiny_front/0001_Bulbasaur.png",
        "frontFrame2": "front_frame2/0001_Bulbasaur.png",
        "shinyFrontFrame2": "shiny_front_frame2/0001_Bulbasaur.png",
        "back": "back/0001_Bulbasaur.png",
        "shinyBack": "shiny_back/0001_Bulbasaur.png",
        "frontFrameCount": 2,
        "missingReason": null
      }
    }
  ],
  "meta": { "total": 1, "page": 1, "pageSize": 40, "totalPages": 1 }
}
```

Totals and ordering depend on the filters. Shared TypeScript contracts live in
`packages/shared/src/dex.ts`.

The species detail response extends the core species record with `learnset`,
`machines`, and `evolutionLinks` arrays. Machine records include the full move plus
`machine`, `kind`, and `number`. Evolution links include both species IDs/names,
`internalOnly`, the rule summary, method/trigger, level, complete conditions, and raw
ROM identifiers. `fromSprite` and `toSprite` contain each endpoint's standard front
filename (or NULL if unavailable), so incoming evolutions and internal form changes
show the correct species/form sprite. Rules retain their original `edgeOrder`. The existing `/evolution`
endpoint continues to return only outgoing player-facing rules.

Core species records, including list and detail responses, include `sprites` with
`front`, `shinyFront`, `frontFrame2`, `shinyFrontFrame2`, `back`, `shinyBack`,
`frontFrameCount`, and `missingReason`. Filenames are relative to the dataset's sprite
folder. Unavailable variants are NULL; `sprites` itself is NULL if no sprite record
has been imported. The four explicitly missing forms retain their source reason.

PNG files are served at `/api/sprites/emerald-ex-1.0.4/:variant/:filename`, for example
`/api/sprites/emerald-ex-1.0.4/front/0001_Bulbasaur.png`. These responses are images,
use a one-day cache with ETag/Last-Modified validation, and return 404 for missing files.
Only PNGs in the six sprite variant folders are served; manifests, directories and
other source documents are not exposed by this route.

All full move records (including learnsets and TM/HM detail records) include
`categoryIconFile`, read from `emerald_ex_move_categories.icon_file`. The category
subresource returns this filename as `iconFile`. NULL means no category icon.
The frontend uses this filename directly, with no built-in mapping or bundled
fallback. Missing images leave the category's accessible text label visible.

Category PNGs are served at `/api/icons/move-categories/:filename` from the backend's
`assets/move-categories/` directory. Only PNG filenames directly inside that
directory are served, with a one-day cache and ETag/Last-Modified validation. Files
are read from disk when requested, so uploading a new filename and changing SQL
does not require an application rebuild or restart. See the
[icon update instructions](database.md#update-move-category-icons).

Type filenames come from `emerald_ex_types.icon_file`. Species list and detail
records expose `typeIconFiles` in the same primary/secondary slot order as `types`
and `typeIds`. Full move, learnset, and machine detail records expose `typeIconFile`.
The type catalog and species/move type subresources return `iconFile` alongside
the unchanged IDs and names.

Type PNGs are served at `/api/icons/types/:filename` from `assets/types/`, with the
same flat-filename restrictions, one-day cache and validators as category icons.
The client displays 24×24 icons with accessible type names and hover titles on
species lists, species headers/stat panels, and level-up/TM/HM tables. NULL or
failed images show the type name instead. Type filters retain their text choices.
See [type icon updates](database.md#update-type-icons).

## Client and deployment

The client requests dataset metadata and types, then fetches each species list page
with the selected filters and sort. Opening `#/species/:id` fetches `/species/:id/details`
and displays stats, types, learnsets, evolution relationships and TM/HM compatibility.
Move descriptions and raw identifiers expand inline; internal form markers are
labelled separately from ordinary evolutions. Hash routes support direct links and
reloads on static hosting without additional frontend rewrite rules. Returning to
the list preserves filters during the session.
The list loads standard front sprites lazily at 64×64. Details show standard and
shiny front sprites at 128×128 with pixel-preserving scaling and labelled alternatives.
Missing references or failed image loads show a placeholder.

TanStack Query caches responses briefly, passes
cancellation signals to fetch, and manages loading/error/retry states. Changing a
query uses a different cache key, so a late response cannot replace the current filter's
results. Client builds do not bundle the source exports or database credentials.

For local development, start both `npm run dev:server` and `npm run dev:client`.
The Vite proxy forwards relative `/api` requests to `DEV_API_TARGET`; no browser CORS
configuration is needed. `vite preview` uses the same proxy.

For production, run `npm run build`, start the Node backend with `NODE_ENV=production`
and the production database settings, and serve `apps/client/dist` as the frontend.
Route `/api/*` on the website's domain to the Node backend, preserving the `/api`
prefix. A static client deployment alone cannot serve these endpoints. The Vite proxy
is a development/preview feature and is not part of the built frontend. Keep all
database credentials in the backend environment. This migration does not deploy the
backend or change production database contents.

Before deploying this sprite update, import `005_species_sprites.sql` and
`006_import_sprites_1.0.4.sql` into the existing database with an administrative
account. Include `assets/pokemon_emerald_ex_1.0.4_battle_sprites/` at its repository-relative
location alongside the backend (including a compiled `apps/server/dist` deployment).
The existing `/api/*` reverse-proxy rule also forwards sprite requests. No client-side
JSON manifest or database credentials are needed.

For this category icon update, import `007_move_category_icons.sql` and
`008_seed_move_category_icons.sql` with an administrative account before deploying
the API. Deploy `assets/move-categories/` alongside the backend at its
repository-relative location, including when running compiled `apps/server/dist`
files. The existing `/api/*` proxy also forwards category image requests.

For type icons, import `009_type_icons.sql` and `010_seed_type_icons.sql` before
deploying the API and include `assets/types/` alongside the backend at its
repository-relative location. The existing `/api/*` proxy forwards these images.

## Verification

`npm run check` runs type checks, lint, formatting and database-independent tests.
`npm run test:db` runs read-only HTTP/SQL integration tests against the local imported
1.0.4 dataset and refuses a remote `DB_HOST`. It checks all 1,523 species against the
source fixture, pagination/filtering/sorting, species and move subresources, empty
relationships, internal-marker exclusion and dataset isolation. Aggregate detail
responses are checked against the source learnsets, complete move data, and evolution
rules in both directions, including internal markers. Sprite references are compared
against the manifest for every species; unit tests check PNG serving, unknown paths,
filename encoding, image alternatives and missing-sprite placeholders.
Move category filenames are compared with SQL across move lists, subresources and
full machine records. Category image tests check PNG bytes and path restrictions;
client tests check replacement filenames and retained text labels. Browser checks
also cover NULL references, missing files and updates without a rebuild/restart.
Type tests compare catalog/slot/move filenames with SQL and verify that all supplied
PNGs are served. Client tests cover the Electric/Dark names, replacement filenames,
and missing-icon text. Browser checks confirm list/detail/move displays and mobile
row visibility, including filename changes without rebuilding or restarting.
