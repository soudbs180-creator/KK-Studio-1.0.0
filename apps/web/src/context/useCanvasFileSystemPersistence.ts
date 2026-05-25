import { useEffect, useMemo, type MutableRefObject } from 'react';
import type { Canvas, GeneratedImage } from '../types';
import { fileSystemService } from '../services/storage/fileSystemService';
import {
    buildCanvasFileSystemPersistenceSignature,
    getCachedStrippedCanvases,
} from './canvasPersistence';

type CanvasFileSystemPersistenceState = {
    canvases: Canvas[];
    activeCanvasId: string;
};

export function useCanvasFileSystemPersistence(params: {
    canvases: Canvas[];
    activeCanvasId: string;
    fileSystemHandle: FileSystemDirectoryHandle | null;
    isLoading: boolean;
    stateRef: MutableRefObject<CanvasFileSystemPersistenceState>;
    isSavingRef: MutableRefObject<boolean>;
    resolveOriginalPersistSourceForDisk: (
        image: Pick<GeneratedImage, 'id' | 'storageId' | 'originalUrl' | 'apiResultUrl' | 'url' | 'mode'>
    ) => Promise<string | null>;
}): void {
    const {
        canvases,
        activeCanvasId,
        fileSystemHandle,
        isLoading,
        stateRef,
        isSavingRef,
        resolveOriginalPersistSourceForDisk,
    } = params;

    const fileSystemPersistenceSignature = useMemo(
        () => fileSystemHandle
            ? buildCanvasFileSystemPersistenceSignature(canvases, activeCanvasId)
            : '',
        [activeCanvasId, canvases, fileSystemHandle]
    );

    useEffect(() => {
        if (isLoading || !fileSystemHandle || !fileSystemPersistenceSignature) return;

        const saveState = async () => {
            isSavingRef.current = true;
            try {
                try {
                    const currentState = stateRef.current;
                    const imagesToSave = new Map<string, Blob>();

                    const imageNodesByStorageId = new Map<string, GeneratedImage>();
                    currentState.canvases.forEach(c => {
                        c.imageNodes.forEach(img => {
                            const storageId = img.storageId || img.id;
                            if (!storageId) return;
                            if (!imageNodesByStorageId.has(storageId)) {
                                imageNodesByStorageId.set(storageId, img);
                            }
                        });
                    });

                    for (const [id, imageNode] of imageNodesByStorageId.entries()) {
                        if (!imageNode) continue;

                        const url = await resolveOriginalPersistSourceForDisk(imageNode);
                        if (!url) {
                            continue;
                        }

                        if (url.startsWith('blob:') || url.startsWith('data:') || /^https?:\/\//i.test(url)) {
                            try {
                                const res = await fetch(url);
                                if (!res.ok) throw new Error('Fetch status: ' + res.status);
                                const blob = await res.blob();
                                imagesToSave.set(id, blob);
                            } catch (err: any) {
                                if (err.message && err.message.includes('ERR_UPLOAD_FILE_CHANGED')) {
                                    console.warn('[CanvasContext] Blob reference lost for ' + id + ' (file changed/moved), skipping save.');
                                } else if (err instanceof TypeError && String(err.message || '').includes('Failed to fetch')) {
                                    // blob/data URLs can expire before save completes; this failure is safe to ignore.
                                } else {
                                    console.warn('[CanvasContext] Skip saving image ' + id + ' (fetch failed):', err);
                                }
                            }
                        }
                    }

                    const cleanCanvases = getCachedStrippedCanvases(currentState.canvases);
                    if (cleanCanvases.length === 0) {
                        console.error('[CanvasContext] Aborting save: canvases array is empty! This would wipe project.json');
                        return;
                    }

                    const fsState = {
                        canvases: cleanCanvases,
                        activeCanvasId: currentState.activeCanvasId || cleanCanvases[0]?.id || 'default',
                        version: 1
                    };

                    console.log('[CanvasContext] Saving project to disk:', {
                        canvasesCount: fsState.canvases.length,
                        activeCanvasId: fsState.activeCanvasId,
                        imagesToSave: imagesToSave.size
                    });

                    await fileSystemService.saveProject(fileSystemHandle, fsState as any, imagesToSave);
                } catch (error) {
                    console.error('File System Save Failed:', error);
                }
            } finally {
                isSavingRef.current = false;
            }
        };

        const timer = setTimeout(saveState, 1000);
        return () => clearTimeout(timer);
    }, [fileSystemPersistenceSignature, fileSystemHandle, isLoading, isSavingRef, resolveOriginalPersistSourceForDisk, stateRef]);
}
