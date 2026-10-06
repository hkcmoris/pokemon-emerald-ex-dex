<?php
declare(strict_types=1);

use EmeraldEx\DexRepository;
use EmeraldEx\HttpError;

use function EmeraldEx\dispatch;
use function EmeraldEx\imagePath;
use function EmeraldEx\requestQuery;
use function EmeraldEx\validateEndpoint;

ini_set('display_errors', '0');
error_reporting(E_ALL);
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/private/Api.php';
require_once __DIR__ . '/private/DexRepository.php';

function jsonResponse(array $body, int $status = 200): never
{
    $json = json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
        echo $json;
    }
    exit;
}

try {
    if (PHP_VERSION_ID < 80400) {
        throw new HttpError(503, 'runtime_unavailable', 'The dex API requires PHP 8.4 or newer');
    }
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) {
        header('Allow: GET, HEAD');
        throw new HttpError(405, 'method_not_allowed', 'Only GET and HEAD requests are supported');
    }
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    if (preg_match('/%(?![a-f0-9]{2})/i', $uri)) {
        throw new HttpError(400, 'invalid_parameter', 'Invalid URL encoding');
    }
    $requestPath = parse_url($uri, PHP_URL_PATH);
    $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')), '/');
    if (!is_string($requestPath) || !str_starts_with($requestPath, $base . '/')) {
        throw new HttpError(404, 'not_found', 'Endpoint not found');
    }
    $path = rawurldecode(substr($requestPath, strlen($base)));
    if ($path === '/health') {
        jsonResponse(['ok' => true]);
    }
    if (str_starts_with($path, '/icons/') || str_starts_with($path, '/sprites/')) {
        $file = imagePath($path, dirname(__DIR__) . '/assets');
        if ($file === null) {
            throw new HttpError(404, 'not_found', 'Image not found');
        }
        header('Content-Type: image/png');
        header('Content-Length: ' . filesize($file));
        header('Cache-Control: public, max-age=86400');
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
            readfile($file);
        }
        exit;
    }
    $query = requestQuery($_SERVER['QUERY_STRING'] ?? '');
    if (!extension_loaded('pdo_mysql') || !extension_loaded('mbstring')) {
        throw new HttpError(503, 'runtime_unavailable', 'The dex API requires pdo_mysql and mbstring');
    }
    validateEndpoint($path, $query);

    // Local environment variables are useful for testing; hosting uses the protected PHP config.
    $configFile = __DIR__ . '/private/config.local.php';
    $config = is_file($configFile) ? require $configFile : [];
    if (!is_array($config)) {
        throw new RuntimeException('Invalid database configuration');
    }
    $settings = [];
    foreach (['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASS', 'DEX_DATASET_ID'] as $key) {
        $value = getenv($key);
        $settings[$key] = $value === false ? ($config[$key] ?? '') : $value;
    }
    foreach (['DB_HOST', 'DB_NAME', 'DB_USER'] as $key) {
        if (!is_string($settings[$key]) || $settings[$key] === '') {
            throw new HttpError(503, 'database_unavailable', 'The dex database is not configured');
        }
    }
    $port = $settings['DB_PORT'] === '' ? 3306 : EmeraldEx\integerParameter((string) $settings['DB_PORT'], 'DB_PORT', 1, 65535);
    if (preg_match('/[;\x00-\x1f]/', $settings['DB_HOST'] . $settings['DB_NAME'])) {
        throw new RuntimeException('Invalid database configuration');
    }
    try {
        $pdo = new PDO('mysql:host=' . $settings['DB_HOST'] . ';port=' . $port . ';dbname=' . $settings['DB_NAME'] . ';charset=utf8mb4',
            $settings['DB_USER'], $settings['DB_PASS'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
                PDO::ATTR_TIMEOUT => 5,
            ]);
    } catch (PDOException $error) {
        error_log('Emerald EX database connection failed: ' . $error->getCode());
        throw new HttpError(503, 'database_unavailable', 'The dex database connection is unavailable');
    }
    $repository = new DexRepository($pdo, $settings['DEX_DATASET_ID'] ?: 'emerald-ex-1.0.4');
    jsonResponse(dispatch($repository, $path, $query));
} catch (HttpError $error) {
    jsonResponse(['error' => ['code' => $error->errorCode, 'message' => $error->getMessage()]], $error->status);
} catch (Throwable $error) {
    // Do not expose SQL, filesystem paths, or credentials in HTTP responses or logs.
    error_log('Emerald EX API failed: ' . get_class($error) . ' (' . $error->getCode() . ')');
    jsonResponse(['error' => ['code' => 'internal_error', 'message' => 'Internal server error']], 500);
}
