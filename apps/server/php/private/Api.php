<?php
declare(strict_types=1);

namespace EmeraldEx;

use RuntimeException;

final class HttpError extends RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }
}

function integerParameter(mixed $value, string $name, int $min, int $max): int
{
    if (!is_string($value) || !preg_match('/^\d+$/D', $value) || (float) $value < $min || (float) $value > $max) {
        throw new HttpError(400, 'invalid_parameter', "$name must be an integer between $min and $max");
    }
    return (int) $value;
}

function stringQuery(mixed $value, string $name, int $maxLength): string
{
    if ($value === null) {
        return '';
    }
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2 > $maxLength) {
        throw new HttpError(400, 'invalid_query', "$name must be a string of at most $maxLength characters");
    }
    return trim($value);
}

function queryKeys(array $query, array $allowed): void
{
    if (array_diff(array_keys($query), $allowed) !== []) {
        throw new HttpError(400, 'invalid_query', 'Unknown query parameter');
    }
}

function pagination(array $query): array
{
    return [
        'page' => isset($query['page']) ? integerParameter($query['page'], 'page', 1, 65535) : 1,
        'pageSize' => isset($query['pageSize']) ? integerParameter($query['pageSize'], 'pageSize', 1, 250) : 40,
    ];
}

// PHP normally overwrites duplicate query keys. Preserve them as arrays so validation rejects them.
function requestQuery(string $queryString): array
{
    $query = [];
    foreach (explode('&', $queryString) as $pair) {
        if ($pair === '') {
            continue;
        }
        [$key, $value] = array_pad(explode('=', $pair, 2), 2, '');
        $key = urldecode($key);
        $value = urldecode($value);
        if (array_key_exists($key, $query)) {
            $query[$key] = [$query[$key], $value];
        } else {
            $query[$key] = $value;
        }
    }
    return $query;
}

function validateEndpoint(string $path, array $query): void
{
    if ($path === '/v1/dataset' || $path === '/v1/types') {
        return;
    }
    if ($path === '/v1/species' || $path === '/v1/moves') {
        queryKeys($query, $path === '/v1/species' ? ['q', 'type', 'sort', 'page', 'pageSize'] : ['q', 'page', 'pageSize']);
        stringQuery($query['q'] ?? null, 'q', 100);
        pagination($query);
        if ($path === '/v1/species') {
            stringQuery($query['type'] ?? null, 'type', 32);
            if (!in_array($query['sort'] ?? 'id', ['id', 'name', 'total', 'speed'], true)) {
                throw new HttpError(400, 'invalid_query', 'sort must be id, name, total, or speed');
            }
        }
        return;
    }
    if (preg_match('~^/v1/(species|moves)/([^/]+)(?:/([^/]+))?$~D', $path, $parts)) {
        $species = $parts[1] === 'species';
        integerParameter($parts[2], $species ? 'species ID' : 'move ID', $species ? 1 : 0, 65535);
        $allowed = $species ? ['name', 'stats', 'types', 'learnset', 'evolution', 'machines', 'details', 'sprites']
            : ['name', 'category', 'pp', 'damage', 'power', 'type'];
        if (isset($parts[3]) && !in_array($parts[3], $allowed, true)) {
            throw new HttpError(404, 'not_found', 'Endpoint not found');
        }
        return;
    }
    throw new HttpError(404, 'not_found', 'Endpoint not found');
}

function dispatch(DexRepository $repository, string $path, array $query): array
{
    validateEndpoint($path, $query);
    if ($path === '/v1/dataset') {
        $dataset = $repository->getDataset();
        if ($dataset === null) {
            throw new HttpError(503, 'dataset_unavailable', 'The configured dex dataset is unavailable');
        }
        return ['data' => $dataset];
    }
    if ($path === '/v1/types') {
        return ['data' => $repository->getTypes()];
    }
    if ($path === '/v1/species') {
        return $repository->listSpecies([
            'q' => stringQuery($query['q'] ?? null, 'q', 100),
            'type' => stringQuery($query['type'] ?? null, 'type', 32),
            'sort' => $query['sort'] ?? 'id', ...pagination($query),
        ]);
    }
    if ($path === '/v1/moves') {
        $page = pagination($query);
        return $repository->listMoves(stringQuery($query['q'] ?? null, 'q', 100), $page['page'], $page['pageSize']);
    }
    preg_match('~^/v1/(species|moves)/([^/]+)(?:/([^/]+))?$~D', $path, $parts);
    $id = (int) $parts[2];
    $resource = $parts[3] ?? '';
    if ($parts[1] === 'species') {
        $species = $resource === 'details' ? $repository->getSpeciesDetails($id) : $repository->getSpecies($id);
        if ($species === null) {
            throw new HttpError(404, 'not_found', 'Species not found');
        }
        $data = match ($resource) {
            'name' => ['name' => $species['name']],
            'stats' => [...$species['stats'], 'baseStatTotal' => $species['baseStatTotal']],
            'types' => $repository->getSpeciesTypes($id),
            'learnset' => $repository->getLearnset($id),
            'evolution' => $repository->getEvolutions($id),
            'machines' => $repository->getMachines($id),
            'sprites' => $species['sprites'],
            default => $species,
        };
        return ['data' => $data];
    }
    $move = $repository->getMove($id);
    if ($move === null) {
        throw new HttpError(404, 'not_found', 'Move not found');
    }
    $data = match ($resource) {
        'name' => ['name' => $move['name']],
        'category' => ['categoryId' => $move['categoryId'], 'name' => $move['category'], 'iconFile' => $move['categoryIconFile']],
        'pp' => ['pp' => $move['pp']],
        'damage', 'power' => ['power' => $move['power'], 'effectId' => $move['effectId']],
        'type' => ['typeId' => $move['typeId'], 'name' => $move['type'], 'iconFile' => $move['typeIconFile']],
        default => $move,
    };
    return ['data' => $data];
}

function imagePath(string $path, string $assetRoot): ?string
{
    if (preg_match('~^/icons/(types|move-categories)/([^/]+)$~D', $path, $parts)) {
        $relative = $parts[1] . '/' . $parts[2];
        $name = $parts[2];
    } elseif (preg_match('~^/sprites/emerald-ex-1\.0\.4/(front|shiny_front|front_frame2|shiny_front_frame2|back|shiny_back)/([^/]+)$~D', $path, $parts)) {
        $relative = 'pokemon_emerald_ex_1.0.4_battle_sprites/' . $parts[1] . '/' . $parts[2];
        $name = $parts[2];
    } else {
        return null;
    }
    if (str_starts_with($name, '.') || preg_match('~[\\\\\x00-\x1f\x7f]~', $name) || !preg_match('/\.png$/iD', $name)) {
        return null;
    }
    $root = realpath($assetRoot);
    $file = realpath($assetRoot . '/' . $relative);
    if ($root === false || $file === false || !is_file($file) || !str_starts_with($file, $root . DIRECTORY_SEPARATOR)) {
        return null;
    }
    return $file;
}
