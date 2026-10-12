<?php
declare(strict_types=1);

require __DIR__ . '/../php/private/Api.php';
require __DIR__ . '/../php/private/Collection.php';

use EmeraldEx\HttpError;
use function EmeraldEx\collectionCsrf;
use function EmeraldEx\validateCollectionDocument;
use function EmeraldEx\verifyGoogleIdentity;

function rejected(callable $callback): void
{
    try { $callback(); }
    catch (HttpError $error) { if ($error->status === 401) { return; } throw $error; }
    throw new RuntimeException('Expected authentication rejection');
}

$csrf = str_repeat('a', 64);
$settings = ['COLLECTION_ALLOWED_ORIGINS' => 'https://devground.cz'];
$_SERVER['HTTP_ORIGIN'] = 'https://devground.cz';
$_SERVER['HTTP_X_CSRF_TOKEN'] = $csrf;
collectionCsrf($csrf, $settings);
foreach (['', 'https://evil.example', 'https://devground.cz/', 'https://devground.cz/pokemon-emerald-ex-dex/'] as $origin) {
    $_SERVER['HTTP_ORIGIN'] = $origin;
    try { collectionCsrf($csrf, $settings); throw new RuntimeException('Expected origin rejection'); }
    catch (HttpError $error) { if ($error->status !== 403 || $error->errorCode !== 'invalid_origin') { throw $error; } }
}
$_SERVER['HTTP_ORIGIN'] = 'https://devground.cz';
foreach (['', str_repeat('b', 64)] as $provided) {
    $_SERVER['HTTP_X_CSRF_TOKEN'] = $provided;
    try { collectionCsrf($csrf, $settings); throw new RuntimeException('Expected CSRF rejection'); }
    catch (HttpError $error) { if ($error->status !== 403 || $error->errorCode !== 'invalid_csrf') { throw $error; } }
}

$input = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
$key = $input['publicKey'];
$claims = verifyGoogleIdentity($input['validToken'], 'our-nonce', 'our-client', ['test-key' => $key], 1700000000);
if ($claims['subject'] !== 'google-subject') { throw new RuntimeException('Unexpected verified identity'); }
foreach ($input['invalidTokens'] as $token) {
    rejected(static fn() => verifyGoogleIdentity($token, 'our-nonce', 'our-client', ['test-key' => $key], 1700000000));
}
rejected(static fn() => verifyGoogleIdentity($input['validToken'], 'wrong-nonce', 'our-client', ['test-key' => $key], 1700000000));
rejected(static fn() => verifyGoogleIdentity($input['validToken'], 'our-nonce', 'other-client', ['test-key' => $key], 1700000000));
// Decode with objects preserved: empty map {} and invalid array [] must remain distinct.
// The original JSON is used because associative decoding would turn empty maps into arrays.
$documents = json_decode($input['documentJson'], false, 64, JSON_THROW_ON_ERROR);
echo json_encode(array_map(validateCollectionDocument(...), $documents), JSON_THROW_ON_ERROR);
