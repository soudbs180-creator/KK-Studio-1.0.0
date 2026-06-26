import type { Canvas } from '../../types';
import { shouldEnableWorkspaceCloudSync } from '../../app/kkaiFeatureFlags';
import { kkWebApiClient } from '../api/kkApiClient';
import { offlineDb, type CachedCardMeta, type OfflinePendingOperation } from '../storage/offlineDb';

// 标志：是否正在进行后台同步
let isSyncing = false;
let syncTimeoutId: number | null = null;

// 在线状态检测
const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

/**
 * 本地优先的云端同步服务
 * 
 * 用户操作直接持久化到 IndexedDB 的未同步队列中，由后台在网络空闲时批量轻同步给服务器。
 */
export const syncService = {
  // === 离线操作队列 ===
  async queueOperation(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE',
    cardId: string,
    data: any
  ): Promise<void> {
    const opId = `${Date.now()}_op_${Math.random().toString(36).slice(2, 9)}`;
    const op: OfflinePendingOperation = {
      id: opId,
      action,
      cardId,
      data,
      timestamp: Date.now()
    };

    // 1. 立即持久化到本地 IndexedDB 操作表
    await offlineDb.addPendingOperation(op);
    console.log(`[SyncService] Queued offline operation: ${action} on ${cardId}`);

    // 2. 触发后台空闲同步
    this.scheduleSync();
  },

  scheduleSync() {
    if (syncTimeoutId !== null) {
      clearTimeout(syncTimeoutId);
    }

    // 🚀 使用 debounce (800ms) 结合 requestIdleCallback，减少高频操作（如拖拽位移）重复同步开销
    syncTimeoutId = window.setTimeout(() => {
      syncTimeoutId = null;
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          void this.triggerSync();
        }, { timeout: 2000 });
      } else {
        void this.triggerSync();
      }
    }, 800);
  },

  // 🚀 核心：执行离线队列增量批处理同步
  async triggerSync(): Promise<void> {
    if (isSyncing) return;
    if (!isOnline()) {
      console.log('[SyncService] Offline. Sync deferred.');
      return;
    }
    if (!shouldEnableWorkspaceCloudSync()) {
      return;
    }

    try {
      isSyncing = true;
      const ops = await offlineDb.getPendingOperations();
      if (ops.length === 0) {
        isSyncing = false;
        return;
      }

      console.log(`[SyncService] Synchronizing ${ops.length} pending operations to server...`);

      // 提取操作发送给后端批处理同步接口
      // 由于 api-client 契约中原本没有包含该新增接口，我们使用 fetch 发送 HTTP 请求
      const response = await fetch('/api/v1/workspaces/layout/batch-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operations: ops })
      });

      if (!response.ok) {
        throw new Error(`Sync server responded with status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        // 同步成功，从本地操作队列物理删除对应已同步的操作
        const seqs = ops.map(op => op.seq).filter((seq): seq is number => seq !== undefined);
        await offlineDb.deletePendingOperations(seqs);
        console.log(`[SyncService] Sync completed successfully. Cleaned up ${seqs.length} ops.`);
      }
    } catch (e) {
      console.error('[SyncService] Synchronization failed, will retry later:', e);
    } finally {
      isSyncing = false;
    }
  },

  // === 元数据与详情加载 ===

  // 🚀 远中景：只拉取轻量的元数据，极大减轻首次加载和缩放时带宽开销
  async loadLayoutMeta(): Promise<any> {
    try {
      // 1. 先尝试从本地 IndexedDB 缓存加载
      const cachedMetas = await offlineDb.getAllCardMetas();
      if (cachedMetas.length > 0 && !isOnline()) {
        console.log(`[SyncService] Loaded ${cachedMetas.length} cardMetas from offline IndexedDB`);
        return { canvases: [{ id: 'default', cardMetas: cachedMetas }] };
      }

      if (!isOnline() || !shouldEnableWorkspaceCloudSync()) {
        return { canvases: [] };
      }

      // 2. 在线时从服务器拉取最新元数据
      const response = await fetch('/api/v1/workspaces/layout/meta');
      if (!response.ok) throw new Error('Failed to load card meta from server');
      
      const resData = await response.json();
      const canvases = resData.data?.canvases || [];

      // 3. 将元数据缓存至本地 IndexedDB
      for (const canvas of canvases) {
        if (Array.isArray(canvas.cardMetas)) {
          await offlineDb.clearCardMetas();
          await offlineDb.saveCardMetas(canvas.cardMetas);
        }
      }

      return resData.data;
    } catch (e) {
      console.error('[SyncService] Failed to load layout meta:', e);
      // 回退至本地缓存
      const cached = await offlineDb.getAllCardMetas();
      return { canvases: [{ id: 'default', cardMetas: cached }] };
    }
  },

  // 🚀 近景与编辑态：按需加载特定卡片详情，成功后放入本地缓存
  async loadCardDetail(cardId: string): Promise<any | null> {
    try {
      // 1. 先尝试从本地数据库加载
      const cachedDetail = await offlineDb.getCardDetail(cardId);
      if (cachedDetail) {
        return cachedDetail;
      }

      if (!isOnline()) return null;

      // 2. 不存在时请求服务器
      const response = await fetch(`/api/v1/workspaces/cards/${cardId}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch card detail from server');
      }

      const resData = await response.json();
      const cardData = resData.data?.detail;

      if (cardData) {
        // 3. 保存入本地详情缓存
        await offlineDb.saveCardDetail(cardId, cardData);
      }

      return cardData;
    } catch (e) {
      console.error(`[SyncService] Failed to load card detail for ${cardId}:`, e);
      return null;
    }
  },

  // === 经典全量后备接口 ===
  async saveLayout(canvases: Canvas[]) {
    try {
      if (!shouldEnableWorkspaceCloudSync()) {
        return;
      }
      if (!isOnline()) {
        console.log('[SyncService] Offline. Full save deferred.');
        return;
      }

      // 把所有当前的最新卡片写进本地 IndexedDB 缓存
      const metas: CachedCardMeta[] = [];
      canvases.forEach(canvas => {
        canvas.promptNodes.forEach(n => metas.push({ id: n.id, x: n.position.x, y: n.position.y, width: n.width || 360, height: n.height || 200, type: 'prompt', updatedAt: n.timestamp }));
        canvas.imageNodes.forEach(n => metas.push({ id: n.id, x: n.position.x, y: n.position.y, width: 400, height: 600, type: 'image', thumbnailUrl: n.apiResultUrl || n.url, updatedAt: n.timestamp }));
      });
      await offlineDb.saveCardMetas(metas);

      // 云端全量同步 (向上兼容)
      await kkWebApiClient.saveWorkspaceLayout({
        canvases: canvases.map(canvas => ({
          id: canvas.id,
          name: canvas.name,
          folderName: canvas.folderName,
          promptNodes: canvas.promptNodes.map((node) => ({ ...node })),
          imageNodes: canvas.imageNodes.map((node) => ({ ...node })),
          groups: canvas.groups.map((group) => ({ ...group })),
          drawings: canvas.drawings.map((drawing) => ({ ...drawing })),
          workflow: canvas.workflow ? { ...canvas.workflow } : undefined,
          lastModified: canvas.lastModified,
        })),
      });

      console.log('[SyncService] Layout full saved via cloud API');
    } catch (e) {
      console.error('[SyncService] Failed to save layout:', e);
    }
  },

  async loadLayout(): Promise<Canvas[]> {
    try {
      if (!shouldEnableWorkspaceCloudSync()) {
        return [];
      }
      if (!isOnline()) {
        // 断网回退：将本地 meta 还原成占位卡片返回
        const cachedMetas = await offlineDb.getAllCardMetas();
        const promptNodes = cachedMetas.filter(m => m.type === 'prompt').map(m => ({ id: m.id, position: { x: m.x, y: m.y }, timestamp: m.updatedAt, prompt: 'Offline Prompt Card', isDraft: false, childImageIds: [], tags: [] } as any));
        const imageNodes = cachedMetas.filter(m => m.type === 'image').map(m => ({ id: m.id, position: { x: m.x, y: m.y }, timestamp: m.updatedAt, url: m.thumbnailUrl || '' } as any));
        return [{ id: 'default', name: 'Offline Workspace', promptNodes, imageNodes, groups: [], drawings: [], lastModified: Date.now() }];
      }

      const response = await kkWebApiClient.getWorkspaceLayout();
      const rawCanvases = response.success && response.data ? response.data.canvases : [];
      return rawCanvases.map((record: any) => ({
        id: record.id,
        name: record.name,
        folderName: record.folderName,
        promptNodes: record.promptNodes || [],
        imageNodes: record.imageNodes || [],
        groups: record.groups || [],
        drawings: record.drawings || [],
        workflow: record.workflow,
        lastModified: record.lastModified || Date.now(),
      }));
    } catch (e) {
      console.error('[SyncService] Failed to load layout:', e);
      return [];
    }
  },

  async uploadImagePair(id: string, blob: Blob): Promise<{ original: string, thumbnail: string }> {
    void id; void blob;
    throw new Error('Cloud image sync is disabled until server-backed asset upload is implemented.');
  }
};

// 🚀 网络在线恢复时，自动拉起同步
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncService] Network online. Triggering automatic backlog sync.');
    void syncService.triggerSync();
  });
}
