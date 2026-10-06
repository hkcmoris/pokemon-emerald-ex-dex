export function apiUrl(path: string, basePath = import.meta.env?.BASE_URL ?? '/'): string {
    return `${basePath.replace(/\/?$/, '/')}api/${path}`;
}
