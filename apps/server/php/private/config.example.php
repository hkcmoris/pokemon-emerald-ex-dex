<?php
declare(strict_types=1);

// Copy to config.local.php and use the values from Webzdarma's PHP and MySQL panel.
// The dex is read-only. Optional collection sync writes only emerald_ex_collection* tables.
return [
    'DB_HOST' => 'YOUR_WEBZDARMA_DATABASE_HOST',
    'DB_PORT' => '3306',
    'DB_NAME' => 'YOUR_EXISTING_DATABASE',
    'DB_USER' => 'YOUR_DATABASE_USER',
    'DB_PASS' => 'YOUR_DATABASE_PASSWORD',
    'DEX_DATASET_ID' => 'emerald-ex-1.0.4',
    'GOOGLE_CLIENT_ID' => '',
    // Exact production origin, e.g. https://devground.cz; no app path or trailing slash.
    'COLLECTION_ALLOWED_ORIGINS' => 'https://YOUR_SITE_HOST',
    'COLLECTION_COOKIE_SECURE' => 'true',
];
