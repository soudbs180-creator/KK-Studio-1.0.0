import type { Canvas } from '../types';

export type NormalizeCanvasForMerge = (canvas: Canvas) => Canvas;

export const getCanvasCardCount = (canvas?: Canvas | null): number => {
    if (!canvas) return 0;
    return (canvas.promptNodes?.length || 0) + (canvas.imageNodes?.length || 0);
};

export const isCanvasEffectivelyEmpty = (canvas?: Canvas | null): boolean => getCanvasCardCount(canvas) === 0;

export const mergeItemsById = <T extends { id: string }>(localItems: T[] = [], diskItems: T[] = []): T[] => {
    const map = new Map<string, T>();
    diskItems.forEach(item => map.set(item.id, item));
    localItems.forEach(item => {
        const existing = map.get(item.id);
        map.set(item.id, existing ? { ...existing, ...item } : item);
    });
    return Array.from(map.values());
};

export const mergeSingleCanvas = (
    localCanvas: Canvas,
    diskCanvas: Canvas,
    normalizeCanvas: NormalizeCanvasForMerge
): Canvas => {
    const localCount = getCanvasCardCount(localCanvas);
    const diskCount = getCanvasCardCount(diskCanvas);

    if (localCount === 0 && diskCount > 0) {
        return normalizeCanvas({
            ...localCanvas,
            ...diskCanvas,
            name: diskCanvas.name || localCanvas.name,
            folderName: diskCanvas.folderName || localCanvas.folderName,
            promptNodes: diskCanvas.promptNodes || [],
            imageNodes: diskCanvas.imageNodes || [],
            groups: diskCanvas.groups || [],
            drawings: diskCanvas.drawings || [],
            connections: diskCanvas.connections || [],
            lastModified: Math.max(localCanvas.lastModified || 0, diskCanvas.lastModified || 0)
        });
    }

    if (diskCount === 0 && localCount > 0) {
        return normalizeCanvas({
            ...diskCanvas,
            ...localCanvas,
            promptNodes: localCanvas.promptNodes || [],
            imageNodes: localCanvas.imageNodes || [],
            groups: localCanvas.groups || [],
            drawings: localCanvas.drawings || [],
            connections: localCanvas.connections || [],
            lastModified: Math.max(localCanvas.lastModified || 0, diskCanvas.lastModified || 0)
        });
    }

    const preferLocal = (localCanvas.lastModified || 0) >= (diskCanvas.lastModified || 0);
    const baseCanvas = preferLocal ? diskCanvas : localCanvas;
    const overrideCanvas = preferLocal ? localCanvas : diskCanvas;

    return normalizeCanvas({
        ...baseCanvas,
        ...overrideCanvas,
        name: overrideCanvas.name || baseCanvas.name,
        folderName: overrideCanvas.folderName || baseCanvas.folderName,
        promptNodes: mergeItemsById(localCanvas.promptNodes || [], diskCanvas.promptNodes || []),
        imageNodes: mergeItemsById(localCanvas.imageNodes || [], diskCanvas.imageNodes || []),
        groups: mergeItemsById(localCanvas.groups || [], diskCanvas.groups || []),
        drawings: mergeItemsById(localCanvas.drawings || [], diskCanvas.drawings || []),
        connections: mergeItemsById(localCanvas.connections || [], diskCanvas.connections || []),
        lastModified: Math.max(localCanvas.lastModified || 0, diskCanvas.lastModified || 0)
    });
};

export const mergeCanvases = (
    local: Canvas[],
    disk: Canvas[],
    normalizeCanvas: NormalizeCanvasForMerge
): Canvas[] => {
    const map = new Map<string, Canvas>();
    disk.forEach(canvas => map.set(canvas.id, canvas));

    local.forEach(localCanvas => {
        const diskCanvas = map.get(localCanvas.id);
        if (!diskCanvas) {
            map.set(localCanvas.id, localCanvas);
            return;
        }

        map.set(localCanvas.id, mergeSingleCanvas(localCanvas, diskCanvas, normalizeCanvas));
    });

    return Array.from(map.values());
};

export const resolvePreferredActiveCanvasId = (
    localActiveId: string | undefined,
    diskActiveId: string | null | undefined,
    canvases: Canvas[]
): string => {
    const localActiveCanvas = localActiveId ? canvases.find(c => c.id === localActiveId) : undefined;
    const diskActiveCanvas = diskActiveId ? canvases.find(c => c.id === diskActiveId) : undefined;

    if (localActiveCanvas && !isCanvasEffectivelyEmpty(localActiveCanvas)) {
        return localActiveCanvas.id;
    }

    if (diskActiveCanvas && !isCanvasEffectivelyEmpty(diskActiveCanvas)) {
        return diskActiveCanvas.id;
    }

    if (localActiveCanvas && diskActiveCanvas && localActiveCanvas.id !== diskActiveCanvas.id) {
        return diskActiveCanvas.id;
    }

    const firstNonEmptyCanvas = canvases.find(canvas => !isCanvasEffectivelyEmpty(canvas));
    if (firstNonEmptyCanvas) {
        return firstNonEmptyCanvas.id;
    }

    if (diskActiveCanvas) return diskActiveCanvas.id;
    if (localActiveCanvas) return localActiveCanvas.id;
    return canvases[0]?.id || 'default';
};
