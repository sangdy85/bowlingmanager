// Search params can be arrays when a key is repeated in the request.
export function searchText(value: unknown, limit = 100): string {
    return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}
export function searchPage(value: unknown): number {
    const text=searchText(value,6);
    return /^\d+$/.test(text) ? Math.max(1,Math.min(10000,Number(text))) : 1;
}
