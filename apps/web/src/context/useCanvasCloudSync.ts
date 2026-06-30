import { useEffect, useMemo, useRef } from 'react';
import type { Canvas } from '../types';
import {
    buildCanvasCloudSyncSignature,
    getCachedStrippedCanvases,
    hasLocalOnlyCanvasMedia,
} from './canvasPersistence';
import {
    getLatestStartupSnapshot,
    isStartupStageReady,
    subscribeStartupSnapshot,
} from '../services/system/appStartup';

type CanvasCloudSyncNodeSnapshot = {
    type: 'prompt' | 'image';
    position?: { x?: number; y?: number };
    prompt?: string;
    isGenerating?: boolean;
    error?: string;
};

const buildCanvasCloudSyncNodeSnapshot = (canvases: Canvas[]): Map<string, CanvasCloudSyncNodeSnapshot> => {
    const snapshot = new Map<string, CanvasCloudSyncNodeSnapshot>();

    canvases.forEach(canvas => {
        canvas.promptNodes.forEach(node => {
            snapshot.set(node.id, {
                type: 'prompt',
                position: node.position,
                prompt: node.prompt,
                isGenerating: node.isGenerating,
                error: node.error,
            });
        });
        canvas.imageNodes.forEach(node => {
            snapshot.set(node.id, {
                type: 'image',
                position: node.position,
                prompt: node.prompt,
                isGenerating: node.isGenerating,
                error: node.error,
            });
        });
    });

    return snapshot;
};

const isWorkspaceStartupReady = (): boolean => (
    isStartupStageReady(getLatestStartupSnapshot().stage, 'workspace_ready')
);

export function useCanvasCloudSync(canvases: Canvas[], isLoading: boolean, enabled: boolean): void {
    const cloudMediaSyncWarningShownRef = useRef(false);
    const previousCloudSyncSignatureRef = useRef('');
    const previousLargeProjectSnapshotRef = useRef<Map<string, CanvasCloudSyncNodeSnapshot> | null>(null);

    const totalCardsCount = useMemo(() => {
        if (!enabled) {
            return 0;
        }
        return canvases.reduce((acc, canvas) => acc + canvas.promptNodes.length + canvas.imageNodes.length, 0);
    }, [enabled, canvases]);

    const isLargeProject = totalCardsCount >= 100;

    const hasCloudSyncLocalOnlyMedia = useMemo(
        () => {
            if (!enabled || isLargeProject) {
                return false;
            }
            return hasLocalOnlyCanvasMedia(canvases);
        },
        [enabled, isLargeProject, canvases]
    );
    const canvasCloudSyncSignature = useMemo(
        () => {
            if (!enabled || hasCloudSyncLocalOnlyMedia) {
                return '';
            }
            if (isLargeProject) {
                return `large:${totalCardsCount}`;
            }
            return buildCanvasCloudSyncSignature(canvases);
        },
        [enabled, hasCloudSyncLocalOnlyMedia, isLargeProject, totalCardsCount, canvases]
    );
    const cloudSyncLayoutPayload = useMemo(
        () => (canvasCloudSyncSignature && !isLargeProject ? getCachedStrippedCanvases(canvases) : []),
        [canvasCloudSyncSignature, isLargeProject, canvases]
    );

    useEffect(() => {
        if (!enabled || isLoading || canvases.length === 0 || previousCloudSyncSignatureRef.current) return;

        let cancelled = false;
        let unsubscribe: (() => void) | null = null;

        const initializeSignature = () => {
            if (cancelled || previousCloudSyncSignatureRef.current || !isWorkspaceStartupReady()) {
                return;
            }

            if (isLargeProject && !hasCloudSyncLocalOnlyMedia) {
                previousLargeProjectSnapshotRef.current = buildCanvasCloudSyncNodeSnapshot(canvases);
                previousCloudSyncSignatureRef.current = `large:${totalCardsCount}`;
            } else {
                previousCloudSyncSignatureRef.current = buildCanvasCloudSyncSignature(canvases);
            }

            unsubscribe?.();
            unsubscribe = null;
        };

        initializeSignature();

        if (!previousCloudSyncSignatureRef.current) {
            unsubscribe = subscribeStartupSnapshot(() => {
                initializeSignature();
            });
        }

        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, [enabled, hasCloudSyncLocalOnlyMedia, isLargeProject, isLoading, totalCardsCount, canvases]);

    useEffect(() => {
        if (!enabled || isLoading || canvases.length === 0) return;

        if (hasCloudSyncLocalOnlyMedia) {
            if (!cloudMediaSyncWarningShownRef.current) {
                console.warn('[CanvasContext] Cloud layout sync skipped because the canvas still depends on local-only media assets.');
                cloudMediaSyncWarningShownRef.current = true;
            }
            return;
        }

        if (!canvasCloudSyncSignature) return;

        cloudMediaSyncWarningShownRef.current = false;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let unsubscribe: (() => void) | null = null;

        const scheduleSave = () => {
            if (cancelled || timer || !isWorkspaceStartupReady()) {
                return;
            }

            timer = setTimeout(() => {
                timer = null;
            previousCloudSyncSignatureRef.current = canvasCloudSyncSignature;

            if (isLargeProject) {
                const prevNodesMap = previousLargeProjectSnapshotRef.current;
                const currentNodesMap = buildCanvasCloudSyncNodeSnapshot(canvases);
                previousLargeProjectSnapshotRef.current = currentNodesMap;

                if (!prevNodesMap) return;

                const operations: Array<{ action: 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE'; cardId: string; data: any }> = [];

                prevNodesMap.forEach((_prevNode, id) => {
                    if (!currentNodesMap.has(id)) {
                        operations.push({ action: 'DELETE', cardId: id, data: {} });
                    }
                });

                currentNodesMap.forEach((currNode, id) => {
                    const prevNode = prevNodesMap.get(id);
                    if (!prevNode) {
                        operations.push({
                            action: 'CREATE',
                            cardId: id,
                            data: { type: currNode.type, detail: currNode },
                        });
                        return;
                    }

                    const posChanged = prevNode.position?.x !== currNode.position?.x
                        || prevNode.position?.y !== currNode.position?.y;
                    if (posChanged) {
                        operations.push({
                            action: 'MOVE',
                            cardId: id,
                            data: currNode.position,
                        });
                    }

                    const dataChanged = prevNode.prompt !== currNode.prompt
                        || prevNode.isGenerating !== currNode.isGenerating
                        || prevNode.error !== currNode.error;
                    if (dataChanged && !posChanged) {
                        operations.push({
                            action: 'UPDATE',
                            cardId: id,
                            data: currNode,
                        });
                    }
                });

                if (operations.length > 0) {
                    console.log(`[SyncService] Detected ${operations.length} incremental operations in large canvas`);
                    import('../services/system/syncService')
                        .then(({ syncService }) => {
                            operations.forEach(op => {
                                void syncService.queueOperation(op.action, op.cardId, op.data);
                            });
                        })
                        .catch(error => console.error('[CanvasContext] Incremental save failed', error));
                }
                return;
            }

            previousLargeProjectSnapshotRef.current = null;
            import('../services/system/syncService')
                .then(({ syncService }) => syncService.saveLayout(cloudSyncLayoutPayload))
                .catch(error => console.error('[CanvasContext] Cloud save failed', error));
            }, 3000);

            unsubscribe?.();
            unsubscribe = null;
        };

        scheduleSave();

        if (!timer && !isWorkspaceStartupReady()) {
            unsubscribe = subscribeStartupSnapshot(() => {
                scheduleSave();
            });
        }

        return () => {
            cancelled = true;
            if (timer) {
                clearTimeout(timer);
            }
            unsubscribe?.();
        };
    }, [canvasCloudSyncSignature, cloudSyncLayoutPayload, enabled, hasCloudSyncLocalOnlyMedia, isLoading, canvases.length, isLargeProject, canvases]);
}
