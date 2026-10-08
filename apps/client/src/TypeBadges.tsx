import { useState } from 'react';

import { apiUrl } from './apiUrl.js';
import { useLanguage } from './language.js';
import { typeDisplayName } from './typeNames.js';

function TypeBadge({
    name,
    file,
    iconOnly,
}: {
    name: string;
    file: string | null;
    iconOnly: boolean;
}) {
    const { language } = useLanguage();
    const label = typeDisplayName(name, language);
    const [failed, setFailed] = useState(false);
    const showIcon = Boolean(file) && !failed;
    return (
        <span
            className={iconOnly ? 'type-icon inline-flex items-center' : 'type-badge mt-0.5'}
            data-type={name}
            title={iconOnly ? label : undefined}
        >
            {file && showIcon && (
                <img
                    src={apiUrl(`icons/types/${encodeURIComponent(file)}`)}
                    alt={iconOnly ? label : ''}
                    width={24}
                    height={24}
                    className={
                        iconOnly
                            ? 'h-6 w-6 shrink-0 object-contain'
                            : 'h-6 w-6 -mt-3 shrink-0 object-contain'
                    }
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailed(true)}
                />
            )}
            {(!iconOnly || !showIcon) && <span className="type-badge-label">{label}</span>}
        </span>
    );
}

export function TypeBadges({
    types,
    iconFiles,
    iconOnly = false,
}: {
    types: readonly string[];
    iconFiles: readonly (string | null)[];
    iconOnly?: boolean;
}) {
    return (
        <span
            className={
                iconOnly
                    ? 'type-icons inline-flex flex-wrap items-center gap-1.5'
                    : 'type-badges flex flex-wrap gap-1.5'
            }
        >
            {types.map((type, index) => {
                const file = iconFiles[index] ?? null;
                return (
                    <TypeBadge
                        key={`${type}:${file ?? ''}`}
                        name={type}
                        file={file}
                        iconOnly={iconOnly}
                    />
                );
            })}
        </span>
    );
}
