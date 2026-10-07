import { useState } from 'react';

import { apiUrl } from './apiUrl.js';

function TypeBadge({ name, file }: { name: string; file: string | null }) {
    const [failed, setFailed] = useState(false);
    return (
        <span className="type-badge mt-0.5" data-type={name}>
            {file && !failed && (
                <img
                    src={apiUrl(`icons/types/${encodeURIComponent(file)}`)}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 -mt-3 shrink-0 object-contain"
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailed(true)}
                />
            )}
            <span className="type-badge-label">{name}</span>
        </span>
    );
}

export function TypeBadges({
    types,
    iconFiles,
}: {
    types: readonly string[];
    iconFiles: readonly (string | null)[];
}) {
    return (
        <span className="type-badges flex flex-wrap gap-1.5">
            {types.map((type, index) => {
                const file = iconFiles[index] ?? null;
                return <TypeBadge key={`${type}:${file ?? ''}`} name={type} file={file} />;
            })}
        </span>
    );
}
