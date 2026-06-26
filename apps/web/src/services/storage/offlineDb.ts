/**
 * KK Studio 本地优先 IndexedDB 离线数据库服务
 * 
 * 管理本地 cardMeta 缓存、按需加载的 cardDetails 缓存以及未同步离线操作队列 (pendingOperations)
 */

export interface OfflinePendingOperation {
  seq?: number;
  id: string; // 唯一UUID，防止重复幂等
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE';
  cardId: string;
  data: any;
  timestamp: number;
}

export interface CachedCardMeta {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'prompt' | 'image' | 'workflow';
  thumbnailUrl?: string;
  updatedAt: number;
}

const DB_NAME = 'KKWorkspaceOfflineDB';
const DB_VERSION = 1;

class OfflineDb {
  private db: IDBDatabase | null = null;

  init(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 元数据表
        if (!db.objectStoreNames.contains('cardMetas')) {
          db.createObjectStore('cardMetas', { keyPath: 'id' });
        }
        
        // 详情表
        if (!db.objectStoreNames.contains('cardDetails')) {
          db.createObjectStore('cardDetails', { keyPath: 'id' });
        }
        
        // 未同步操作队列表，自增序列
        if (!db.objectStoreNames.contains('pendingOperations')) {
          db.createObjectStore('pendingOperations', { keyPath: 'seq', autoIncrement: true });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[OfflineDB] Initialization failed:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  // === CardMeta ===
  async saveCardMetas(metas: CachedCardMeta[]): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cardMetas', 'readwrite');
      const store = tx.objectStore('cardMetas');
      
      metas.forEach(meta => store.put(meta));
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllCardMetas(): Promise<CachedCardMeta[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cardMetas', 'readonly');
      const store = tx.objectStore('cardMetas');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async clearCardMetas(): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cardMetas', 'readwrite');
      const store = tx.objectStore('cardMetas');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // === CardDetails ===
  async saveCardDetail(cardId: string, detail: any): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cardDetails', 'readwrite');
      const store = tx.objectStore('cardDetails');
      store.put({ id: cardId, detail, cachedAt: Date.now() });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCardDetail(cardId: string): Promise<any | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cardDetails', 'readonly');
      const store = tx.objectStore('cardDetails');
      const request = store.get(cardId);

      request.onsuccess = () => {
        resolve(request.result ? request.result.detail : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeCardDetail(cardId: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cardDetails', 'readwrite');
      const store = tx.objectStore('cardDetails');
      const request = store.delete(cardId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // === Pending Operations ===
  async addPendingOperation(op: OfflinePendingOperation): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingOperations', 'readwrite');
      const store = tx.objectStore('pendingOperations');
      const request = store.add(op);

      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingOperations(): Promise<OfflinePendingOperation[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingOperations', 'readonly');
      const store = tx.objectStore('pendingOperations');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePendingOperations(seqs: number[]): Promise<void> {
    if (seqs.length === 0) return;
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingOperations', 'readwrite');
      const store = tx.objectStore('pendingOperations');
      
      seqs.forEach(seq => store.delete(seq));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineDb = new OfflineDb();
