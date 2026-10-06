import { useState } from 'react';

import { apiUrl } from './apiUrl.js';

export function spriteUrl(datasetId: string | undefined, file: string | null): string | null {
    if (!datasetId || !file) return null;
    return apiUrl(
        `sprites/${encodeURIComponent(datasetId)}/${file.split('/').map(encodeURIComponent).join('/')}`,
    );
}

function SpriteImage({
    src,
    alt,
    size,
    loading,
}: {
    src: string | null;
    alt: string;
    size: 64 | 128;
    loading: 'lazy' | 'eager';
}) {
    const [failed, setFailed] = useState(false);
    return (
        <span className="species-sprite" style={{ width: size, height: size }}>
            {src && !failed ? (
                <img
                    src={src}
                    alt={alt}
                    width={size}
                    height={size}
                    loading={loading}
                    decoding="async"
                    onError={() => setFailed(true)}
                />
            ) : (
                <span className="sprite-placeholder" role="img" aria-label={`${alt} unavailable`}>
                    —
                </span>
            )}
        </span>
    );
}

export function SpeciesSprite({
    datasetId,
    file,
    name,
    shiny = false,
    size = 64,
    loading = 'lazy',
}: {
    datasetId: string | undefined;
    file: string | null;
    name: string;
    shiny?: boolean;
    size?: 64 | 128;
    loading?: 'lazy' | 'eager';
}) {
    const src = spriteUrl(datasetId, file);
    return (
        <SpriteImage
            key={src}
            src={src}
            alt={`${name} ${shiny ? 'shiny' : 'standard'} front sprite`}
            size={size}
            loading={loading}
        />
    );
}
