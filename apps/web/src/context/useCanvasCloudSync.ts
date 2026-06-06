import { useEffect, useMemo, useRef } from 'react';
import type { Canvas } from '../types';
import {
    buildCanvasCloudSyncSignature,
    getCachedStrippedCanvases,
    hasLocalOnlyCanvasMedia,
} from './canvasPersistence';

export function useCanvasCloudSync(canvases: Canvas[], isLoading: boolean, enabled: boolean): void {
    const cloudMediaSyncWarningShownRef = useRef(false);
    const hasCloudSyncLocalOnlyMedia = useMemo(
        () => hasLocalOnlyCanvasMedia(canvases),
        [canvases]
    );
    const canvasCloudSyncSignature = useMemo(
        () => hasCloudSyncLocalOnlyMedia ? '' : buildCanvasCloudSyncSignature(canvases),
        [hasCloudSyncLocalOnlyMedia, canvases]
    );
    const cloudSyncLayoutPayload = useMemo(
        () => canvasCloudSyncSignature ? getCachedStrippedCanvases(canvases) : [],
        [canvasCloudSyncSignature, canvases]
    );

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

        const timer = setTimeout(() => {
            import('../services/system/syncService')
                .then(({ syncService }) => syncService.saveLayout(cloudSyncLayoutPayload))
                .catch(e => console.error('[CanvasContext] Cloud save failed', e));
        }, 3000);

        return () => clearTimeout(timer);
    }, [canvasCloudSyncSignature, cloudSyncLayoutPayload, enabled, hasCloudSyncLocalOnlyMedia, isLoading, canvases.length]);
}
