<?php
declare(strict_types=1);

// Local preview only. Apache uses the bundled .htaccess files on Webzdarma.
$prefix = '/pokemon-emerald-ex-dex';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (!is_string($path) || !str_starts_with($path, $prefix . '/')) {
    http_response_code(404);
    exit;
}
$relative = rawurldecode(substr($path, strlen($prefix)));
if (str_starts_with($relative, '/api/')) {
    if (str_starts_with($relative, '/api/private/') || str_contains($relative, '/.')) {
        http_response_code(403);
        exit;
    }
    $_SERVER['SCRIPT_NAME'] = $prefix . '/api/index.php';
    require $_SERVER['DOCUMENT_ROOT'] . '/api/index.php';
    exit;
}
$root = realpath($_SERVER['DOCUMENT_ROOT']);
$file = realpath($root . ($relative === '/' ? '/index.html' : $relative));
if ($file === false || !is_file($file) || !str_starts_with($file, $root . DIRECTORY_SEPARATOR)
    || str_contains($relative, '/.') || !in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), ['html', 'js', 'css', 'png'], true)) {
    http_response_code(404);
    exit;
}
$mime = ['html' => 'text/html; charset=utf-8', 'js' => 'text/javascript', 'css' => 'text/css', 'png' => 'image/png'];
header('Content-Type: ' . $mime[strtolower(pathinfo($file, PATHINFO_EXTENSION))]);
readfile($file);
