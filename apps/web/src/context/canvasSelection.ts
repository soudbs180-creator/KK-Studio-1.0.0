export type CanvasSelectionMode = 'replace' | 'add' | 'remove' | 'toggle';

export function resolveCanvasSelectionIds(
    currentSelectedNodeIds: readonly string[] | null | undefined,
    ids: readonly string[],
    mode: CanvasSelectionMode = 'replace',
): string[] {
    const current = new Set(currentSelectedNodeIds || []);

    switch (mode) {
        case 'replace':
            return [...ids];

        case 'add':
            ids.forEach(id => current.add(id));
            return Array.from(current);

        case 'remove':
            ids.forEach(id => current.delete(id));
            return Array.from(current);

        case 'toggle':
            ids.forEach(id => {
                if (current.has(id)) {
                    current.delete(id);
                } else {
                    current.add(id);
                }
            });
            return Array.from(current);

        default:
            return [...ids];
    }
}
