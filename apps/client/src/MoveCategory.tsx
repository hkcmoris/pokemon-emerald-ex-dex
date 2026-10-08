import { useState } from 'react';

import { apiUrl } from './apiUrl.js';

export function MoveCategoryIcon({ file, label }: { file: string; label?: string }) {
    const [failed, setFailed] = useState(false);
    if (failed) return label ? <span>{label}</span> : null;
    return (
        <img
            src={apiUrl(`icons/move-categories/${encodeURIComponent(file)}`)}
            alt={label ?? ''}
            className="h-6 w-7 shrink-0 object-contain"
            onError={() => setFailed(true)}
        />
    );
}

export function MoveCategory({
    category,
    iconFile,
    iconOnly = false,
}: {
    category: string;
    iconFile: string | null;
    iconOnly?: boolean;
}) {
    return (
        <span
            className={
                iconOnly
                    ? 'move-category-icon inline-flex items-center whitespace-nowrap'
                    : 'inline-flex items-center gap-1.5 whitespace-nowrap'
            }
            title={iconOnly ? category : undefined}
        >
            {iconFile && (
                <MoveCategoryIcon
                    key={iconFile}
                    file={iconFile}
                    label={iconOnly ? category : undefined}
                />
            )}
            {(!iconOnly || !iconFile) && <span>{category}</span>}
        </span>
    );
}
