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
the 13 dex tables. Apply schema/import scripts separately with an administrative
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
| `/api/v1/types` | Complete ROM type catalog, sorted by name |
| `/api/v1/species` | Paginated species with stats and ordered type names/IDs |
| `/api/v1/species/:id` | One species/form with stats and types |
| `/api/v1/species/:id/name` | `{ name }` |
| `/api/v1/species/:id/stats` | Six stats and `baseStatTotal` |
| `/api/v1/species/:id/types` | Ordered `{ typeId, name, slot }` records |
| `/api/v1/species/:id/learnset` | Ordered level-up entries with full move records |
| `/api/v1/species/:id/evolution` | Outgoing evolution rules, excluding internal routing markers |
| `/api/v1/species/:id/machines` | TM/HM compatibility records |
| `/api/v1/moves` | Paginated moves, ordered by internal move ID |
| `/api/v1/moves/:id` | Full move record including description and engine IDs |
| `/api/v1/moves/:id/name` | `{ name }` |
| `/api/v1/moves/:id/category` | `{ categoryId, name }` |
| `/api/v1/moves/:id/pp` | `{ pp }` |
| `/api/v1/moves/:id/type` | `{ typeId, name }` |
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
      "stats": { "hp": 45, "attack": 49, "defense": 49, "spAttack": 65, "spDefense": 65, "speed": 45 },
      "baseStatTotal": 318
    }
  ],
  "meta": { "total": 1, "page": 1, "pageSize": 40, "totalPages": 1 }
}
```

Totals and ordering depend on the filters. Shared TypeScript contracts live in
`packages/shared/src/dex.ts`.

## Client and deployment

The client requests dataset metadata and types, then fetches each species page with
the selected filters and sort. TanStack Query caches responses briefly, passes
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

## Verification

`npm run check` runs type checks, lint, formatting and database-independent tests.
`npm run test:db` runs read-only HTTP/SQL integration tests against the local imported
1.0.4 dataset and refuses a remote `DB_HOST`. It checks all 1,523 species against the
source fixture, pagination/filtering/sorting, species and move subresources, empty
relationships, internal-marker exclusion and dataset isolation.
