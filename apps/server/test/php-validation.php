<?php
declare(strict_types=1);

require __DIR__ . '/../php/private/Api.php';

use EmeraldEx\HttpError;
use function EmeraldEx\imagePath;
use function EmeraldEx\integerParameter;
use function EmeraldEx\requestQuery;
use function EmeraldEx\validateEndpoint;

function expectError(callable $callback, int $status): void
{
    try {
        $callback();
    } catch (HttpError $error) {
        if ($error->status === $status) {
            return;
        }
        throw $error;
    }
    throw new RuntimeException('Expected HTTP error ' . $status);
}

foreach (['-1', '1.5', '1e2', '65536', 'NaN', ['1']] as $id) {
    expectError(static fn() => integerParameter($id, 'ID', 1, 65535), 400);
}
foreach (['q=a&q=b', 'page=0', 'pageSize=251', 'sort=DROP+TABLE', 'extra=1', 'q=' . str_repeat('a', 101)] as $query) {
    expectError(static fn() => validateEndpoint('/v1/species', requestQuery($query)), 400);
}
validateEndpoint('/v1/species', requestQuery('q=%230001&type=Poison&sort=speed&page=2&pageSize=40'));
validateEndpoint('/v1/species/0001/details', []);
validateEndpoint('/v1/moves/0/type', []);
expectError(static fn() => validateEndpoint('/v1/species/1/private', []), 404);
expectError(static fn() => validateEndpoint('/v1/species/1/details/extra', []), 404);
foreach (['/icons/types/../config.png', '/icons/types/.secret.png', '/icons/types/a\\b.png', '/icons/types/a.png/extra', '/sprites/emerald-ex-1.0.4/private/a.png'] as $path) {
    if (imagePath($path, $argv[1]) !== null) {
        throw new RuntimeException('Unsafe image path accepted');
    }
}
if (imagePath('/icons/types/48px-Fire.png', $argv[1]) === null) {
    throw new RuntimeException('Missing known type icon');
}
echo "PHP validation passed\n";
