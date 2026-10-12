<?php
declare(strict_types=1);

require __DIR__ . '/../php/private/Api.php';
require __DIR__ . '/../php/private/Collection.php';

use EmeraldEx\HttpError;
use function EmeraldEx\validateCollectionDocument;
use function EmeraldEx\verifyGoogleIdentity;

function rejected(callable $callback): void
{
    try { $callback(); }
    catch (HttpError $error) { if ($error->status === 401) { return; } throw $error; }
    throw new RuntimeException('Expected authentication rejection');
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
