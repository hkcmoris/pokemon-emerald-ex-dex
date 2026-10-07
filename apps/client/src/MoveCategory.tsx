import { useState } from 'react';

import { apiUrl } from './apiUrl.js';

export function MoveCategoryIcon({ file }: { file: string }) {
    const [failed, setFailed] = useState(false);
    if (failed) return null;
    return (
        <img
            src={apiUrl(`icons/move-categories/${encodeURIComponent(file)}`)}
            alt=""
            className="h-6 w-7 shrink-0 object-contain"
            onError={() => setFailed(true)}
        />
    );
}

export function MoveCategory({
    category,
    iconFile,
}: {
    category: string;
    iconFile: string | null;
}) {
    return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {iconFile && <MoveCategoryIcon key={iconFile} file={iconFile} />}
            <span>{category}</span>
        </span>
    );
}
