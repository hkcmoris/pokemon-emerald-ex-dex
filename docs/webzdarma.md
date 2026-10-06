# Webzdarma PHP 8.4 deployment

Target URL: `https://devground.cz/pokemon-emerald-ex-dex/`.
The frontend stays in React/TypeScript. The hosting runs the PHP API directly;
it does not need Node.js, Composer, npm, a running service, or a reverse proxy.
The Node API remains available for local development and parity checks.

## Prepare the upload locally

From the repository root:

```powershell
npm run build:webzdarma
```

This builds the frontend for `/pokemon-emerald-ex-dex/` and prepares one folder:

```text
dist/webzdarma/
├── .htaccess
├── index.html
├── UPLOAD.txt
├── assets/
│   ├── index-….js
│   ├── index-….css
│   ├── move-categories/
│   ├── types/
│   └── pokemon_emerald_ex_1.0.4_battle_sprites/
└── api/
    ├── .htaccess
    ├── index.php
    └── private/
        ├── .htaccess
        ├── Api.php
        ├── DexRepository.php
        └── config.example.php
```

The bundle includes all 7,992 sprite PNGs, category/type PNGs, and the protected
configuration template. It excludes JSON imports, the sprite manifest, SQL
scripts, `.env` files, `config.local.php`, tests, Node modules, and source maps.
Each build replaces the generated upload folder. Configure production credentials
on the server after uploading, and preserve the server's configuration on updates.

## Upload with FileZilla

1. Select PHP **8.4** for `devground.cz` in Webzdarma's administration. The API
   requires `pdo_mysql` and `mbstring`. Check the database connection values in
   the **PHP and MySQL** section; the host can differ by account. See
   [Webzdarma's database instructions](https://www.webzdarma.cz/podpora/49-programovani-a-databaze/121-jak-nastavit-sve-pripojeni-k-sql-serveru).
2. In FileZilla, open the local `dist/webzdarma/` folder and the remote
   `pokemon-emerald-ex-dex/` folder inside your website's public directory.
3. Upload **everything inside** `dist/webzdarma/`. Upload its contents, so
   `index.html` is directly under `pokemon-emerald-ex-dex/`. Include every hidden
   `.htaccess` file; enable **Server → Force showing hidden files** if necessary.
4. Download `api/private/config.example.php`, rename the downloaded file to
   `config.local.php`, fill in the values below, and upload it back into the
   server's `api/private/` directory:

   ```php
   <?php
   declare(strict_types=1);

   return [
       'DB_HOST' => 'database host from your hosting panel',
       'DB_PORT' => '3306',
       'DB_NAME' => 'your existing shared database',
       'DB_USER' => 'your database user',
       'DB_PASS' => 'your database password',
       'DEX_DATASET_ID' => 'emerald-ex-1.0.4',
   ];
   ```

   Use the production database with the imported `emerald_ex_*` tables. Keep
   PHP single-quoted strings valid: escape a password's `'` as `\'` and a
   literal backslash as `\\`. The private directory denies browser access.
5. Check the URLs below, then open the dex.

No new SQL migration is required for PHP hosting. If the production database
has not yet received the previous sprite/category/type upgrades, import
`005_species_sprites.sql`, `006_import_sprites_1.0.4.sql`,
`007_move_category_icons.sql`, `008_seed_move_category_icons.sql`,
`009_type_icons.sql`, and `010_seed_type_icons.sql` in that order. Do not reimport
the original data just to change the backend. No database creation is needed.

## Integrate with the main site's .htaccess

The website root has its own `.htaccess`, one directory above the dex. The
reviewed replacement is `docs/webzdarma-parent.htaccess`. Download a backup of
the current root file, then upload this replacement to the **website root** and
rename it to `.htaccess`. This file is separate from the generated dex bundle.

The replacement adds this rule immediately after `RewriteEngine On`, before
the main site's API rewrites and SPA fallback:

```apache
RewriteRule ^pokemon-emerald-ex-dex(?:/|$) - [L]
```

This excludes the dex from those rewrites so its own `.htaccess` files can
handle API requests. Keep `[L]`: `[END]` would also stop subsequent rewriting in
child directories. See [Apache's rewrite flags](https://httpd.apache.org/docs/2.4/rewrite/flags.html#flag_end).

The sensitive-file block also uses `Require all denied` in place of legacy
`Order Allow,Deny` and `Deny from all`. Those older directives require
`mod_access_compat`; without it, Apache can reject the configuration. See
[Apache's access-control migration guide](https://httpd.apache.org/docs/2.4/upgrading.html#access).
The original uploaded file remains in `docs/.htaccess` for comparison. The
replacement keeps its other rules and headers.

This addresses possible configuration conflicts; the exact cause of an HTTP
500 still needs the server error log or a successful deployment check. Local
PHP preview tests do not validate Apache configuration.

## Verify the deployment

* `https://devground.cz/pokemon-emerald-ex-dex/api/health` returns `{"ok":true}`.
* `https://devground.cz/pokemon-emerald-ex-dex/api/v1/dataset` returns dataset
  metadata with a species/form count of 1,523. This verifies database access.
* `https://devground.cz/pokemon-emerald-ex-dex/api/v1/species/1/details` returns
  Bulbasaur's stats, types, sprites, learnset, evolutions, and machines.
* `https://devground.cz/pokemon-emerald-ex-dex/api/v1/species/94/evolution` returns
  the full Gastly → Haunter → Gengar line, including both trade and Linking Cord
  rules for Haunter → Gengar (three rules total).
* `https://devground.cz/pokemon-emerald-ex-dex/api/icons/types/48px-Fire.png`
  displays the fire type icon.
* `https://devground.cz/pokemon-emerald-ex-dex/api/private/config.local.php`
  must return HTTP **403**, confirming that configuration is protected.
* Open `https://devground.cz/pokemon-emerald-ex-dex/` and a species detail page
  to verify standard/shiny sprites and move/type icons.

If health returns 404, check the remote directory and hidden `.htaccess` files.
If even `index.html` or a PNG returns Apache's HTML **500 Internal Server Error**
page, the failure happens before the PHP API. Check the server error log for a
rejected directive, syntax error, or permissions problem in `.htaccess`.
The bundle uses only `RewriteEngine`, `RewriteCond`, and `RewriteRule`; it does
not override `Options`, `DirectoryIndex`, or authorization module settings.
For an older upload, overwrite the app root `.htaccess`, `api/.htaccess`, and
`api/private/.htaccess` with the regenerated versions. Keep the private directory
protected. Save manually edited `.htaccess` files as plain UTF-8 without a BOM.
If it returns `runtime_unavailable`, check PHP 8.4 and the required extensions.
If dataset returns `database_unavailable`, check `config.local.php` and the
database values in the hosting panel. A 500 may indicate missing previous SQL
migrations; the HTTP response never includes SQL or passwords. Server logs record
the exception class/code for troubleshooting.

## Local PHP checks

PHP 8.4 with `pdo_mysql` and `mbstring` is required. Set `PHP_BINARY` to its
executable in the ignored `.env.local` if the default `php` points elsewhere.
Keep your local MariaDB credentials in `.env.local`.

```powershell
npm run build:webzdarma
npm run dev:php
```

Open `http://127.0.0.1:3001/pokemon-emerald-ex-dex/`. The local preview router
simulates subfolder routing; Apache uses `.htaccess` on the production hosting.
The built-in PHP server is only used for local preview and tests.

```powershell
npm run test:php:db
npm run check
```

The explicit database check rebuilds the bundle and compares both APIs against
local MariaDB. It uses SELECT only and refuses a remote DB host. Regular checks
include PHP syntax/validation checks when PHP CLI is available; HTTP tests need
PHP 8.4 and report a skip when only an older PHP is installed.

For later updates, rebuild and upload the generated contents. Keep the remote
`api/private/config.local.php`; it is excluded from generated bundles, so a normal
overwrite upload preserves it. Confirm FileZilla finishes all transfers.
