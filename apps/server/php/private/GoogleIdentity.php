<?php
declare(strict_types=1);

namespace EmeraldEx;

function invalidGoogleToken(): HttpError
{
    return new HttpError(401, 'invalid_credential', 'Google sign-in could not be verified');
}

function googleTokenPart(string $part): string
{
    $value = base64_decode(strtr($part, '-_', '+/'), true);
    if ($value === false) { throw invalidGoogleToken(); }
    return $value;
}

function googleCertificates(): array
{
    // Fetch public certificates only at sign-in, never send the credential to Google.
    $context = stream_context_create(['http' => ['timeout' => 5, 'follow_location' => 0, 'ignore_errors' => true], 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $body = @file_get_contents('https://www.googleapis.com/oauth2/v1/certs', false, $context, 0, 100000);
    $headers = http_get_last_response_headers() ?? [];
    if ($body === false || !preg_match('~^HTTP/\S+ 200\b~', $headers[0] ?? '')) {
        throw new HttpError(503, 'identity_unavailable', 'Google sign-in is temporarily unavailable');
    }
    $keys = json_decode($body, true);
    if (!is_array($keys) || count($keys) > 20 || count($keys) === 0) {
        throw new HttpError(503, 'identity_unavailable', 'Google sign-in is temporarily unavailable');
    }
    foreach ($keys as $key => $pem) {
        if (!is_string($key) || !is_string($pem) || !str_contains($pem, 'BEGIN CERTIFICATE')) {
            throw new HttpError(503, 'identity_unavailable', 'Google sign-in is temporarily unavailable');
        }
    }
    return $keys;
}

function verifyGoogleIdentity(string $credential, string $nonce, string $clientId, ?array $certificates = null, ?int $now = null): array
{
    if (!extension_loaded('openssl')) { throw new HttpError(503, 'runtime_unavailable', 'Google sign-in requires OpenSSL'); }
    if (strlen($credential) > 16000 || !preg_match('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/D', $credential)) { throw invalidGoogleToken(); }
    [$headerPart, $payloadPart, $signaturePart] = explode('.', $credential);
    $header = json_decode(googleTokenPart($headerPart), true);
    $claims = json_decode(googleTokenPart($payloadPart), true);
    $now ??= time();
    if (!is_array($header) || !is_array($claims) || ($header['alg'] ?? null) !== 'RS256' || !is_string($header['kid'] ?? null) || strlen($header['kid']) > 256 ||
        ($claims['aud'] ?? null) !== $clientId || !in_array($claims['iss'] ?? null, ['accounts.google.com', 'https://accounts.google.com'], true) ||
        !is_int($claims['exp'] ?? null) || $claims['exp'] <= $now || !is_int($claims['iat'] ?? null) || $claims['iat'] > $now + 60 || $claims['exp'] - $claims['iat'] > 86400 ||
        (isset($claims['nbf']) && (!is_int($claims['nbf']) || $claims['nbf'] > $now)) ||
        ($claims['nonce'] ?? null) !== $nonce || !is_string($claims['sub'] ?? null) || !preg_match('/^[A-Za-z0-9_-]{1,255}$/D', $claims['sub']) ||
        (isset($claims['azp']) && $claims['azp'] !== $clientId)) { throw invalidGoogleToken(); }
    $certificates ??= googleCertificates();
    $key = $certificates[$header['kid']] ?? null;
    if (!is_string($key) || openssl_verify($headerPart . '.' . $payloadPart, googleTokenPart($signaturePart), $key, OPENSSL_ALGO_SHA256) !== 1) { throw invalidGoogleToken(); }
    return ['subject' => $claims['sub'], 'name' => is_string($claims['name'] ?? null) ? mb_substr($claims['name'], 0, 200) : 'Player', 'email' => is_string($claims['email'] ?? null) ? mb_substr($claims['email'], 0, 320) : ''];
}
