/**
 * @file localWorkspace.ts
 * @module apps/web/src/services/providers
 * @description 本地工作区存储服务。基于现代浏览器 File System Access API 和 IndexedDB，
 *              支持用户挂载本地物理磁盘文件夹，将大体积图片、视频和音频文件直接持久化落盘，
 *              实现 VPS 服务器带宽零承压。
 * @author KK-Studio Team
 * @version 1.5.5
 */

const DB_NAME = 'kk-studio-workspace-db';
const STORE_NAME = 'workspace-store';
const KEY_NAME = 'directory-handle';

/**
 * 获取原生的 IndexedDB 数据库实例
 */
function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 将文件夹句柄保存到 IndexedDB (依靠结构化克隆算法)
 */
async function saveHandleToDB(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(handle, KEY_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * 从 IndexedDB 加载已保存的文件夹句柄
 */
async function loadHandleFromDB(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_NAME);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('[LocalWorkspace] 从 IndexedDB 加载文件夹句柄失败:', error);
    return null;
  }
}

export class LocalWorkspaceService {
  private static instance: LocalWorkspaceService;
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  private constructor() {
    // 异步尝试静默加载句柄
    this.tryRestoreHandle();
  }

  public static getInstance(): LocalWorkspaceService {
    if (!LocalWorkspaceService.instance) {
      LocalWorkspaceService.instance = new LocalWorkspaceService();
    }
    return LocalWorkspaceService.instance;
  }

  /**
   * 尝试静默恢复已保存的本地工作区句柄
   */
  private async tryRestoreHandle(): Promise<void> {
    const savedHandle = await loadHandleFromDB();
    if (savedHandle) {
      this.directoryHandle = savedHandle;
      console.log('[LocalWorkspace] 成功从本地缓存恢复工作区句柄。');
    }
  }

  /**
   * 检查是否已挂载工作区
   */
  public isMounted(): boolean {
    return this.directoryHandle !== null;
  }

  /**
   * 挂载本地物理磁盘工作区（需要用户交互触发）
   */
  public async mount(): Promise<boolean> {
    try {
      if (typeof (window as any).showDirectoryPicker !== 'function') {
        throw new Error('当前浏览器不支持 File System Access API，建议使用 Chrome 或 Edge。');
      }

      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'pictures'
      });

      this.directoryHandle = handle;
      await saveHandleToDB(handle);
      console.log('[LocalWorkspace] 成功挂载本地工作区:', handle.name);
      return true;
    } catch (error) {
      console.error('[LocalWorkspace] 挂载工作区失败:', error);
      return false;
    }
  }

  /**
   * 验证并请求读写权限（若页面刷新后需重新授权）
   */
  public async verifyPermission(): Promise<boolean> {
    if (!this.directoryHandle) {
      return false;
    }

    try {
      // 查询当前的读写权限
      const options = { mode: 'readwrite' as const };
      const currentPermission = await (this.directoryHandle as any).queryPermission(options);
      
      if (currentPermission === 'granted') {
        return true;
      }

      // 请求读写权限
      const requestResult = await (this.directoryHandle as any).requestPermission(options);
      return requestResult === 'granted';
    } catch (error) {
      console.error('[LocalWorkspace] 验证工作区权限失败:', error);
      return false;
    }
  }

  /**
   * 卸载工作区，清除 IndexedDB 缓存
   */
  public async unmount(): Promise<void> {
    this.directoryHandle = null;
    try {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(KEY_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      console.log('[LocalWorkspace] 工作区已成功卸载。');
    } catch (error) {
      console.error('[LocalWorkspace] 卸载工作区失败:', error);
    }
  }

  /**
   * 获取已挂载工作区的文件夹名称
   */
  public getWorkspaceName(): string {
    return this.directoryHandle ? this.directoryHandle.name : '';
  }

  /**
   * 将大体积的多媒体文件（图片、视频、音频）直接保存至本地磁盘
   * @param filename 文件名（如 kkai-generate-1234.png）
   * @param contentBlob 文件的 Blob 二进制流
   * @returns 返回落盘后的虚拟本地 URL，以便前端直接高效秒开渲染
   */
  public async saveMediaFile(filename: string, contentBlob: Blob): Promise<string> {
    if (!this.directoryHandle) {
      throw new Error('未挂载本地工作区，无法直接落盘大文件。');
    }

    const hasPermission = await this.verifyPermission();
    if (!hasPermission) {
      throw new Error('未取得本地工作区的写入权限，操作被阻断。');
    }

    try {
      // 创建或获取对应文件
      const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: true });
      // 创建可写流并写入数据
      const writable = await fileHandle.createWritable();
      await writable.write(contentBlob);
      await writable.close();

      console.log(`[LocalWorkspace] 媒体文件已完美落盘至本地物理磁盘: ${filename}`);

      // 生成本地高效预览 URL 供前端零延迟加载
      return URL.createObjectURL(contentBlob);
    } catch (error) {
      console.error(`[LocalWorkspace] 保存媒体文件 [${filename}] 失败:`, error);
      throw error;
    }
  }

  /**
   * 从本地磁盘读取文件
   */
  public async readMediaFile(filename: string): Promise<Blob> {
    if (!this.directoryHandle) {
      throw new Error('未挂载本地工作区。');
    }

    const hasPermission = await this.verifyPermission();
    if (!hasPermission) {
      throw new Error('未取得本地工作区的读取权限。');
    }

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return file;
    } catch (error) {
      console.error(`[LocalWorkspace] 读取文件 [${filename}] 失败:`, error);
      throw error;
    }
  }
}

export const localWorkspace = LocalWorkspaceService.getInstance();
