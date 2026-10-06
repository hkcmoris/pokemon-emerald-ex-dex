import { useState } from 'react';

import { apiUrl } from './apiUrl.js';

function TypeBadge({ name, file }: { name: string; file: string | null }) {
    const [failed, setFailed] = useState(false);
    return file && !failed ? (
        <img
            src={apiUrl(`icons/types/${encodeURIComponent(file)}`)}
            alt={name}
            title={name}
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 object-contain"
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
        />
    ) : (
        <span className="type-badge" data-type={name}>
            {name}
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
        <span className="flex flex-wrap gap-1.5">
            {types.map((type, index) => {
                const file = iconFiles[index] ?? null;
                return <TypeBadge key={`${type}:${file ?? ''}`} name={type} file={file} />;
            })}
        </span>
    );
}
