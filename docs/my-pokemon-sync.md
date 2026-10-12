# My Pokémon sign-in and synchronization

Google authenticates the player only. Playthroughs, Pokémon, moves, and growth
observations are stored in **our MySQL database**, with browser storage for offline
work. No Google Drive storage, Google database, or Google collection access is used.
Guest collections work without configuring Google.

## Server setup

1. Apply the additive `scripts/sql/022_my_pokemon.sql` migration to the existing dex
   database. For the local database, `npm run db:migrate` includes this migration.
   Back up production and import this file through the hosting database administrator;
   do not rerun the replacement dex import.
2. Create a Google OAuth client of type **Web application**. Register the exact
   browser origins (scheme, host, and port, without the app path) for local and
   production use. Configure the Google consent screen and test users where required.
   [Google setup documentation](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
3. Set `GOOGLE_CLIENT_ID` to that public client ID, and set
   `COLLECTION_ALLOWED_ORIGINS` to a comma-separated allowlist of the same origins.
   Google Identity Services returns a signed credential through the browser callback;
   no client secret or OAuth redirect handler is needed by this integration.
4. Use HTTPS and `COLLECTION_COOKIE_SECURE=true` in production. Only local HTTP
   development should use `false`. Sessions last 90 days; browser privacy settings
   or cookie clearing may require another sign-in earlier.
5. Node reads `.env.local` locally and `.env` in production. PHP/Webzdarma reads the
   protected `api/private/config.local.php` copied from the provided example, with
   environment variables taking precedence. Keep that local config out of uploads
   and Git. The deployment package includes both collection PHP implementation files.

PHP 8.4 requires `pdo_mysql`, `mbstring`, `openssl`, and HTTPS stream access
(`allow_url_fopen`) with a working CA certificate trust store. Node requires outbound
HTTPS to `www.googleapis.com`; PHP does too, to retrieve public signing certificates
at sign-in. The identity token itself is verified locally and is never logged or
stored. Test login on both devices after configuring the client ID; this repository
cannot register or validate a live Google client on your behalf.

The database user needs SELECT/INSERT/UPDATE/DELETE access to the three new
`emerald_ex_collection*` tables. Dex tables remain read-only at runtime. Database
administration/migration permissions are separate from the runtime user.

## API contract

All paths below are under `/api/v1/collection`, including under the deployment prefix.
All responses use `Cache-Control: no-store` and must stay out of service-worker caches.

| Method/path | Behavior |
| --- | --- |
| `GET /config` | `{data:{googleClientId:string|null}}` |
| `GET /session` | Signed-in `{data:{user:{id,name,email},csrfToken}}`, or `{data:{user:null,csrfToken,nonce}}` with an HttpOnly challenge cookie |
| `POST /session` | JSON `{credential}`, `X-CSRF-Token` and trusted `Origin`; credential must contain the `nonce` passed to GIS initialization |
| `DELETE /session` | Requires the session's CSRF token and trusted `Origin`; revokes only this browser's session |
| `GET /` | Requires session; `{data:{userId,revision,document}}` |
| `PUT /` | JSON `{revision,document}`, session CSRF token and trusted `Origin`; returns the next revision with `userId`, or HTTP 409 with the current `{data:{userId,revision,document}}` |

Google's `sub` is the external identity key, never the email or a client-provided
account ID. The database assigns its own user ID. Credentials require Google's RSA
signature, exact audience, trusted issuer, expiry, issued-at, and matching nonce.
Node caches public keys according to Google's cache lifetime. PHP fetches current
certificates for each sign-in. Both accept only RS256 and fixed Google key URLs.
[Google verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
and [nonce reference](https://developers.google.com/identity/gsi/web/reference/js-reference#nonce).

Session cookies are HttpOnly, SameSite=Lax, and Secure in production. Only a SHA-256
digest of the random session token is stored in MySQL. Sign-in rotates it; expired
sessions are rejected and cleaned up on subsequent sign-ins. All writes check both
the browser origin and a CSRF token. Collection payloads are bounded to 5 MiB and
validated, including ownership references, party constraints, and nested fields.

The server changes a document only if its revision still matches, using one atomic
conditional SQL UPDATE. HTTP 409 therefore cannot overwrite another device's edit.
The browser merges against its saved common ancestor and presents incompatible
alternatives for resolution. Revision numbers are independent of device clocks.
Every snapshot includes the authenticated `userId`, so a browser detects an account
switch in another tab before storing a response in the previous account's workspace.

The browser holds separate guest/account workspaces. Automatic guest upload retains
stable entry IDs so retries do not create duplicates. Sign-out does not reclassify
account data as guest data; pending account edits stay attached to that account.
Automatic synchronization runs while the app is open and connected.

Operationally, back up the collection tables with the normal database backups.
No live Google credentials, production migration, or public deployment is included
in the repository implementation or automated tests.
