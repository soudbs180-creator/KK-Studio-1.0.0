import { useEffect, useMemo, useRef } from 'react';
import type { Canvas } from '../types';
import {
    buildCanvasCloudSyncSignature,
    getCachedStrippedCanvases,
    hasLocalOnlyCanvasMedia,
} from './canvasPersistence';

/**
 * 混合分流式云端同步管理器
 * 
 * 1. 当项目卡片少于 100 张时，使用经典的全量云端同步保持最大兼容性。
 * 2. 当项目卡片超过 100 张（大项目/超大项目）时，自动转为“增量轻同步”模式：
 *    利用 3000ms 的 debounce 周期，在 React 状态改变后进行增量差分（Diff）比对，
 *    仅将 MOVE、CREATE、DELETE 操作入队到 IndexedDB 操作日志中，由 Idle Queue 同步器异步发给后端，
 *    彻底杜绝超大项目全量大 JSON 同步引起的页面假死、掉帧与网络堵塞。
 */
export function useCanvasCloudSync(canvases: Canvas[], isLoading: boolean, enabled: boolean): void {
    const cloudMediaSyncWarningShownRef = useRef(false);
    const previousCanvasesRef = useRef<Canvas[]>([]);
    
    const totalCardsCount = useMemo(() => {
        return canvases.reduce((acc, c) => acc + c.promptNodes.length + c.imageNodes.length, 0);
    }, [canvases]);

    const isLargeProject = totalCardsCount >= 100;

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

    // 在 canvases 初次加载完毕后，初始化比对基准
    useEffect(() => {
        if (!isLoading && canvases.length > 0 && previousCanvasesRef.current.length === 0) {
            previousCanvasesRef.current = JSON.parse(JSON.stringify(canvases));
        }
    }, [isLoading, canvases]);

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
            if (isLargeProject) {
                // === 🚀 增量轻同步模式 (大项目/超大项目) ===
                const prevCanvases = previousCanvasesRef.current;
                previousCanvasesRef.current = JSON.parse(JSON.stringify(canvases));

                if (prevCanvases.length === 0) return;

                // 1. 获取所有的旧节点
                const prevNodesMap = new Map<string, any>();
                prevCanvases.forEach(canvas => {
                    canvas.promptNodes.forEach(n => prevNodesMap.set(n.id, { ...n, type: 'prompt' }));
                    canvas.imageNodes.forEach(n => prevNodesMap.set(n.id, { ...n, type: 'image' }));
                });

                // 2. 获取所有的新节点
                const currentNodesMap = new Map<string, any>();
                canvases.forEach(canvas => {
                    canvas.promptNodes.forEach(n => currentNodesMap.set(n.id, { ...n, type: 'prompt' }));
                    canvas.imageNodes.forEach(n => currentNodesMap.set(n.id, { ...n, type: 'image' }));
                });

                // 3. 计算增量 differences
                const operations: Array<{ action: 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE', cardId: string, data: any }> = [];

                // A. 检测删除
                prevNodesMap.forEach((prevNode, id) => {
                    if (!currentNodesMap.has(id)) {
                        operations.push({ action: 'DELETE', cardId: id, data: {} });
                    }
                });

                // B. 检测新建、移动、更新
                currentNodesMap.forEach((currNode, id) => {
                    const prevNode = prevNodesMap.get(id);
                    if (!prevNode) {
                        // 新建
                        operations.push({
                            action: 'CREATE',
                            cardId: id,
                            data: { type: currNode.type, detail: currNode }
                        });
                    } else {
                        // 比较位置是否移动
                        const posChanged = prevNode.position?.x !== currNode.position?.x || prevNode.position?.y !== currNode.position?.y;
                        if (posChanged) {
                            operations.push({
                                action: 'MOVE',
                                cardId: id,
                                data: currNode.position
                            });
                        }
                        
                        // 比较关键数据是否改变
                        const dataChanged = prevNode.prompt !== currNode.prompt || prevNode.isGenerating !== currNode.isGenerating || prevNode.error !== currNode.error;
                        if (dataChanged && !posChanged) {
                            operations.push({
                                action: 'UPDATE',
                                cardId: id,
                                data: currNode
                            });
                        }
                    }
                });

                // 4. 如果有增量变化，批量提交本地 IndexedDB 队列
                if (operations.length > 0) {
                    console.log(`[SyncService] Detected ${operations.length} incremental operations in large canvas`);
                    import('../services/system/syncService')
                        .then(({ syncService }) => {
                            operations.forEach(op => {
                                void syncService.queueOperation(op.action, op.cardId, op.data);
                            });
                        })
                        .catch(e => console.error('[CanvasContext] Incremental save failed', e));
                }
            } else {
                // === 🚀 经典全量同步模式 (小项目) ===
                previousCanvasesRef.current = JSON.parse(JSON.stringify(canvases));
                import('../services/system/syncService')
                    .then(({ syncService }) => syncService.saveLayout(cloudSyncLayoutPayload))
                    .catch(e => console.error('[CanvasContext] Cloud save failed', e));
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [canvasCloudSyncSignature, cloudSyncLayoutPayload, enabled, hasCloudSyncLocalOnlyMedia, isLoading, canvases.length, isLargeProject, canvases]);
}
