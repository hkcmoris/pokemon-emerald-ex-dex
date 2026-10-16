<?php
declare(strict_types=1);

namespace EmeraldEx;

use PDO;
use stdClass;
use Throwable;

require_once __DIR__ . '/GoogleIdentity.php';

function collectionId(mixed $value): bool
{
    return is_string($value) && (bool) preg_match('/^[A-Za-z0-9_-]{1,80}$/D', $value) && !in_array($value, ['__proto__', 'prototype', 'constructor'], true);
}

function collectionKeys(mixed $value, array $keys): bool
{
    return $value instanceof stdClass && count(get_object_vars($value)) === count($keys) && array_diff(array_keys(get_object_vars($value)), $keys) === [];
}

function collectionInteger(mixed $value, int $min, int $max): bool
{
    return is_int($value) && $value >= $min && $value <= $max;
}

function collectionText(mixed $value, int $max): bool
{
    return is_string($value) && mb_check_encoding($value, 'UTF-8') && strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2 <= $max;
}

function collectionDate(mixed $value): bool
{
    return is_string($value) && strlen($value) <= 40 && preg_match('/^\d{4}-\d{2}-\d{2}T/', $value) && strtotime($value) !== false;
}

function emptyCollection(): stdClass
{
    return (object) ['version' => 1, 'playthroughs' => new stdClass(), 'pokemon' => new stdClass(), 'observations' => new stdClass()];
}

function validateCollectionDocument(mixed $document): bool
{
    if (!collectionKeys($document, ['version', 'playthroughs', 'pokemon', 'observations']) || $document->version !== 1) { return false; }
    foreach (['playthroughs' => 50, 'pokemon' => 3000, 'observations' => 10000] as $field => $limit) {
        if (!$document->$field instanceof stdClass || count(get_object_vars($document->$field)) > $limit) { return false; }
        foreach (get_object_vars($document->$field) as $id => $value) {
            if (!collectionId((string) $id) || !$value instanceof stdClass || ($value->id ?? null) !== (string) $id || !is_bool($value->deleted ?? null)) { return false; }
        }
    }
    foreach ($document->playthroughs as $run) {
        if (!collectionKeys($run, ['id', 'name', 'party', 'deleted']) || !collectionText($run->name, 80) || trim($run->name) === '' || !is_array($run->party) || count($run->party) > 6) { return false; }
        $seen = [];
        foreach ($run->party as $id) {
            if (!collectionId($id) || isset($seen[$id])) { return false; }
            $seen[$id] = true;
            $pokemon = $document->pokemon->$id ?? null;
            if (!$pokemon instanceof stdClass || ($pokemon->playthroughId ?? null) !== $run->id || $pokemon->deleted) { return false; }
        }
    }
    foreach ($document->pokemon as $pokemon) {
        $pokemonKeys = ['id', 'playthroughId', 'nickname', 'state', 'deleted', 'createdAt'];
        if (property_exists($pokemon, 'moveWishlist')) { $pokemonKeys[] = 'moveWishlist'; }
        if (property_exists($pokemon, 'natureId')) { $pokemonKeys[] = 'natureId'; }
        if (property_exists($pokemon, 'ability')) { $pokemonKeys[] = 'ability'; }
        if (!collectionKeys($pokemon, $pokemonKeys) || !collectionId($pokemon->playthroughId) || !isset($document->playthroughs->{$pokemon->playthroughId}) || !collectionText($pokemon->nickname, 40) || !collectionDate($pokemon->createdAt) ||
            !collectionKeys($pokemon->state, ['speciesId', 'level', 'moves', 'formEpoch']) || !collectionInteger($pokemon->state->speciesId, 1, 100000) || !collectionInteger($pokemon->state->level, 1, 100) || !collectionId($pokemon->state->formEpoch)) { return false; }
        if (property_exists($pokemon, 'moveWishlist')) {
            $wishlist = $pokemon->moveWishlist;
            if (!collectionKeys($wishlist, ['moves', 'learnedMoveIds', 'targetSpeciesId']) ||
                ($wishlist->targetSpeciesId !== null && !collectionInteger($wishlist->targetSpeciesId, 1, 100000)) ||
                !is_array($wishlist->moves) || count($wishlist->moves) > 1000 ||
                !is_array($wishlist->learnedMoveIds) || count($wishlist->learnedMoveIds) > 100000) { return false; }
            $seen = [];
            foreach ($wishlist->moves as $move) {
                if (!collectionKeys($move, ['moveId', 'name']) || !collectionInteger($move->moveId, 1, 100000) || !collectionText($move->name, 80) || trim($move->name) === '' || isset($seen[$move->moveId])) { return false; }
                $seen[$move->moveId] = true;
            }
            $seen = [];
            foreach ($wishlist->learnedMoveIds as $moveId) {
                if (!collectionInteger($moveId, 1, 100000) || isset($seen[$moveId])) { return false; }
                $seen[$moveId] = true;
            }
        }
        if (property_exists($pokemon, 'natureId') && $pokemon->natureId !== null && !collectionInteger($pokemon->natureId, 0, 24)) { return false; }
        if (property_exists($pokemon, 'ability') && $pokemon->ability !== null &&
            (!collectionKeys($pokemon->ability, ['speciesId', 'abilityId']) || !collectionInteger($pokemon->ability->speciesId, 1, 100000) || !collectionInteger($pokemon->ability->abilityId, 1, 100000))) { return false; }
        $moves = $pokemon->state->moves;
        if ($moves !== null) {
            if (!is_array($moves) || count($moves) > 4) { return false; }
            $seen = [];
            foreach ($moves as $move) {
                if (!collectionKeys($move, ['moveId', 'name']) || !collectionInteger($move->moveId, 1, 100000) || !collectionText($move->name, 80) || trim($move->name) === '' || isset($seen[$move->moveId])) { return false; }
                $seen[$move->moveId] = true;
            }
        }
    }
    foreach ($document->observations as $observation) {
        if (!collectionKeys($observation, ['id', 'pokemonId', 'speciesId', 'level', 'formEpoch', 'recordedAt', 'stats', 'deleted']) || !collectionId($observation->pokemonId) || !isset($document->pokemon->{$observation->pokemonId}) || !collectionInteger($observation->speciesId, 1, 100000) || !collectionInteger($observation->level, 1, 100) || !collectionId($observation->formEpoch) || !collectionDate($observation->recordedAt) || !$observation->stats instanceof stdClass) { return false; }
        $stats = get_object_vars($observation->stats);
        if (count($stats) === 0 || array_diff(array_keys($stats), ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed']) !== []) { return false; }
        foreach ($stats as $value) { if (!collectionInteger($value, 1, 65535)) { return false; } }
    }
    return true;
}

function collectionCookie(string $name): string
{
    $value = $_COOKIE[$name] ?? '';
    return is_string($value) && preg_match('/^[a-f0-9]{64}$/D', $value) ? $value : '';
}

function collectionCookieOptions(array $settings, int $expires): array
{
    return ['expires' => $expires, 'path' => '/', 'secure' => ($settings['COLLECTION_COOKIE_SECURE'] ?? 'true') !== 'false', 'httponly' => true, 'samesite' => 'Lax'];
}

function collectionCsrf(string $token, array $settings): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $origins = array_filter(array_map('trim', explode(',', (string) ($settings['COLLECTION_ALLOWED_ORIGINS'] ?? ''))));
    if (!in_array($_SERVER['HTTP_ORIGIN'] ?? '', $origins, true)) { throw new HttpError(403, 'invalid_origin', 'Collection sync is not configured for this website address. Check COLLECTION_ALLOWED_ORIGINS on the server.'); }
    if ($token === '' || !hash_equals($token, $provided)) { throw new HttpError(403, 'invalid_csrf', 'Refresh sign-in and try again'); }
}

function collectionBody(): stdClass
{
    if (strtolower(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]) !== 'application/json') { throw new HttpError(400, 'invalid_body', 'A JSON object is required'); }
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 5 * 1024 * 1024) { throw new HttpError(413, 'invalid_body', 'Collection exceeds 5 MB'); }
    $input = file_get_contents('php://input', false, null, 0, 5 * 1024 * 1024 + 1);
    if ($input === false || strlen($input) > 5 * 1024 * 1024) { throw new HttpError(413, 'invalid_body', 'Collection exceeds 5 MB'); }
    $body = json_decode($input, false, 32);
    if (!$body instanceof stdClass) { throw new HttpError(400, 'invalid_body', 'A JSON object is required'); }
    return $body;
}

function collectionSession(PDO $pdo): ?array
{
    $token = collectionCookie('emerald_collection_session');
    if ($token === '') { return null; }
    $query = $pdo->prepare('SELECT u.user_id AS id, u.display_name AS name, u.email, s.csrf_token AS csrfToken FROM emerald_ex_collection_sessions s JOIN emerald_ex_collection_users u ON u.user_id = s.user_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()');
    $query->execute([hash('sha256', $token)]);
    $row = $query->fetch(PDO::FETCH_ASSOC);
    return $row ? ['user' => ['id' => $row['id'], 'name' => $row['name'], 'email' => $row['email']], 'csrfToken' => $row['csrfToken']] : null;
}

function collectionRead(PDO $pdo, string $userId): array
{
    $query = $pdo->prepare('SELECT revision, document FROM emerald_ex_collections WHERE user_id = ?');
    $query->execute([$userId]);
    $row = $query->fetch(PDO::FETCH_ASSOC);
    if (!$row || !validateCollectionDocument($document = json_decode($row['document']))) { throw new \RuntimeException('Stored collection is invalid'); }
    return ['userId' => $userId, 'revision' => (int) $row['revision'], 'document' => $document];
}

// Dispatch only this explicitly writable namespace; the dex API remains read-only.
function dispatchCollection(?PDO $pdo, string $path, array $settings): array
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $clientId = (string) ($settings['GOOGLE_CLIENT_ID'] ?? '');
    if ($path === '/v1/collection/config' && in_array($method, ['GET', 'HEAD'], true)) { return ['data' => ['googleClientId' => $clientId ?: null]]; }
    if ($path === '/v1/collection/session' && in_array($method, ['GET', 'HEAD'], true)) {
        $current = $pdo ? collectionSession($pdo) : null;
        if ($current) { return ['data' => $current]; }
        $nonce = collectionCookie('emerald_collection_challenge') ?: bin2hex(random_bytes(32));
        setcookie('emerald_collection_challenge', $nonce, collectionCookieOptions($settings, time() + 600));
        return ['data' => ['user' => null, 'csrfToken' => $nonce, 'nonce' => $nonce]];
    }
    if (!$pdo) { throw new HttpError(503, 'sync_unavailable', 'Collection sync is not configured'); }
    if ($path === '/v1/collection/session' && $method === 'POST') {
        if ($clientId === '' || empty($settings['COLLECTION_ALLOWED_ORIGINS'])) { throw new HttpError(503, 'sync_unavailable', 'Google sign-in is not configured'); }
        $nonce = collectionCookie('emerald_collection_challenge');
        collectionCsrf($nonce, $settings);
        $body = collectionBody();
        if (array_diff(array_keys(get_object_vars($body)), ['credential', 'nonce']) !== [] || !is_string($body->credential ?? null)) { throw new HttpError(400, 'invalid_body', 'A Google credential is required'); }
        $identity = verifyGoogleIdentity($body->credential, $nonce, $clientId);
        $token = bin2hex(random_bytes(32));
        $csrf = bin2hex(random_bytes(32));
        $pdo->beginTransaction();
        try {
            $query = $pdo->prepare('INSERT INTO emerald_ex_collection_users (user_id, google_subject, display_name, email) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), email = VALUES(email)');
            $query->execute([bin2hex(random_bytes(16)), $identity['subject'], $identity['name'], $identity['email']]);
            $query = $pdo->prepare('SELECT user_id AS id, display_name AS name, email FROM emerald_ex_collection_users WHERE google_subject = ?');
            $query->execute([$identity['subject']]);
            $user = $query->fetch(PDO::FETCH_ASSOC);
            $query = $pdo->prepare('INSERT INTO emerald_ex_collection_sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)');
            $query->execute([hash('sha256', $token), $user['id'], $csrf, gmdate('Y-m-d H:i:s', time() + 7776000)]);
            $query = $pdo->prepare('INSERT IGNORE INTO emerald_ex_collections (user_id, revision, document) VALUES (?, 0, ?)');
            $query->execute([$user['id'], json_encode(emptyCollection(), JSON_THROW_ON_ERROR)]);
            $query = $pdo->prepare('DELETE FROM emerald_ex_collection_sessions WHERE token_hash = ? OR expires_at <= UTC_TIMESTAMP()');
            $query->execute([hash('sha256', collectionCookie('emerald_collection_session'))]);
            $pdo->commit();
        } catch (Throwable $error) { $pdo->rollBack(); throw $error; }
        setcookie('emerald_collection_challenge', '', collectionCookieOptions($settings, 1));
        setcookie('emerald_collection_session', $token, collectionCookieOptions($settings, time() + 7776000));
        return ['data' => ['user' => $user, 'csrfToken' => $csrf]];
    }
    $current = collectionSession($pdo);
    if (!$current) { throw new HttpError(401, 'sign_in_required', 'Sign in to synchronize your collection'); }
    if ($path === '/v1/collection/session' && $method === 'DELETE') {
        collectionCsrf($current['csrfToken'], $settings);
        $query = $pdo->prepare('DELETE FROM emerald_ex_collection_sessions WHERE token_hash = ?');
        $query->execute([hash('sha256', collectionCookie('emerald_collection_session'))]);
        setcookie('emerald_collection_session', '', collectionCookieOptions($settings, 1));
        return ['data' => ['user' => null]];
    }
    if ($path === '/v1/collection' && in_array($method, ['GET', 'HEAD'], true)) { return ['data' => collectionRead($pdo, $current['user']['id'])]; }
    if ($path === '/v1/collection' && $method === 'PUT') {
        collectionCsrf($current['csrfToken'], $settings);
        $body = collectionBody();
        if (!collectionKeys($body, ['revision', 'document']) || !collectionInteger($body->revision, 0, 4294967294) || !validateCollectionDocument($body->document)) { throw new HttpError(400, 'invalid_collection', 'Invalid collection document or revision'); }
        $query = $pdo->prepare('UPDATE emerald_ex_collections SET document = ?, revision = revision + 1 WHERE user_id = ? AND revision = ?');
        $query->execute([json_encode($body->document, JSON_THROW_ON_ERROR), $current['user']['id'], $body->revision]);
        if ($query->rowCount() === 0) {
            http_response_code(409);
            return ['error' => ['code' => 'revision_conflict', 'message' => 'Another device updated this collection'], 'data' => collectionRead($pdo, $current['user']['id'])];
        }
        return ['data' => ['userId' => $current['user']['id'], 'revision' => $body->revision + 1, 'document' => $body->document]];
    }
    throw new HttpError(405, 'method_not_allowed', 'Unsupported collection request');
}
