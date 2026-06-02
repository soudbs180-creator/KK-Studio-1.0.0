// 简体中文：资产状态管理器 (Asset Store)

import { create } from 'zustand';
import type { ImageAsset, FileAsset, OutputAsset, AssetContextSummary, AssetCollection } from '../ai-takeover/types';
import { detectSensitiveFile } from './sensitiveFileScanner';

interface AssetStoreState {
  images: ImageAsset[];
  files: FileAsset[];
  outputs: OutputAsset[];
  collections: AssetCollection[];
  addImage: (file: File, relativePath?: string, collectionId?: string) => void;
  addImageCollection: (files: Array<{ file: File; relativePath?: string }>, name?: string) => string;
  addFile: (file: File, relativePath?: string) => void;
  updateFile: (id: string, patch: Partial<FileAsset>) => void;
  updateImage: (id: string, patch: Partial<ImageAsset>) => void;
  removeAsset: (id: string, kind: 'image' | 'file') => void;
  getAssetsSummary: () => AssetContextSummary;
  clearAll: () => void;
}

export const useAssetStore = create<AssetStoreState>((set, get) => ({
  images: [],
  files: [],
  outputs: [],
  collections: [],

  addImage: (file: File, relativePath?: string, collectionId?: string) => {
    const id = 'img_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const objectUrl = URL.createObjectURL(file);

    const newImage: ImageAsset = {
      id,
      kind: 'image',
      name: file.name,
      mimeType: file.type,
      size: file.size,
      relativePath: relativePath || file.name,
      thumbnailUrl: objectUrl,
      localFile: file,
      uploadState: 'local_ready', // 默认本地就绪，不自动上传 AI
      collectionId
    };

    set(state => ({
      images: [...state.images, newImage]
    }));
  },

  addImageCollection: (files: Array<{ file: File; relativePath?: string }>, name?: string) => {
    const getRootFolderName = (relativePath?: string) => {
      if (!relativePath) return '导入图片';
      return relativePath.split('/')[0] || '导入图片';
    };

    const rootName = name || (files.length > 0 ? getRootFolderName(files[0].relativePath) : '导入图片');
    const collectionId = 'col_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

    const addedIds: string[] = [];
    const newImages: ImageAsset[] = [];

    files.forEach(item => {
      const id = 'img_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      const objectUrl = URL.createObjectURL(item.file);
      const newImage: ImageAsset = {
        id,
        kind: 'image',
        name: item.file.name,
        mimeType: item.file.type,
        size: item.file.size,
        relativePath: item.relativePath || item.file.name,
        thumbnailUrl: objectUrl,
        localFile: item.file,
        uploadState: 'local_ready',
        collectionId
      };
      newImages.push(newImage);
      addedIds.push(id);
    });

    const newCollection: AssetCollection = {
      id: collectionId,
      name: rootName,
      kind: 'image_folder',
      source: 'directory_picker',
      assetIds: addedIds,
      createdAt: Date.now()
    };

    set(state => ({
      images: [...state.images, ...newImages],
      collections: [...(state.collections || []), newCollection]
    }));

    return collectionId;
  },

  addFile: (file: File, relativePath?: string) => {
    const id = 'file_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const scan = detectSensitiveFile(file, relativePath);

    const newFile: FileAsset = {
      id,
      kind: 'file',
      name: file.name,
      mimeType: file.type,
      size: file.size,
      relativePath: relativePath || file.name,
      localFile: file,
      uploadState: scan.sensitive ? 'blocked_sensitive' : 'linked', // 敏感文件标记隔离，默认 linked 懒上传
      sensitive: scan.sensitive,
      sensitiveReason: scan.reason
    };

    set(state => ({
      files: [...state.files, newFile]
    }));
  },

  updateFile: (id: string, patch: Partial<FileAsset>) => {
    set(state => ({
      files: state.files.map(f => (f.id === id ? { ...f, ...patch } : f))
    }));
  },

  updateImage: (id: string, patch: Partial<ImageAsset>) => {
    set(state => ({
      images: state.images.map(img => (img.id === id ? { ...img, ...patch } : img))
    }));
  },

  removeAsset: (id: string, kind: 'image' | 'file') => {
    if (kind === 'image') {
      const img = get().images.find(i => i.id === id);
      if (img?.thumbnailUrl) {
        URL.revokeObjectURL(img.thumbnailUrl); // 释放预览 URL
      }
      set(state => ({
        images: state.images.filter(i => i.id !== id)
      }));
    } else {
      set(state => ({
        files: state.files.filter(f => f.id !== id)
      }));
    }
  },

  getAssetsSummary: (): AssetContextSummary => {
    const { images, files, outputs, collections = [] } = get();

    const poolCollections: any[] = [...collections];
    const untaggedImages = images.filter(img => !img.collectionId);
    if (untaggedImages.length > 0 || poolCollections.length === 0) {
      poolCollections.push({
        id: 'assets_pool',
        name: '项目导入资源池',
        kind: 'mixed',
        source: 'file_input',
        assetIds: untaggedImages.map(img => img.id),
        createdAt: Date.now()
      });
    }

    return {
      imageCollections: poolCollections.map(col => ({
        id: col.id,
        name: col.name,
        imageCount: col.assetIds.length
      })),
      images: images.map(img => ({
        id: img.id,
        name: img.name,
        width: img.width,
        height: img.height,
        collectionId: img.collectionId || 'assets_pool',
        uploadState: img.uploadState
      })),
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        uploadState: f.uploadState,
        sensitive: f.sensitive
      })),
      outputs: outputs.map(out => ({
        id: out.id,
        name: out.name,
        sourceCardId: out.sourceCardId,
        sourceBatchId: out.sourceBatchId
      }))
    };
  },

  clearAll: () => {
    get().images.forEach(img => {
      if (img.thumbnailUrl) URL.revokeObjectURL(img.thumbnailUrl);
    });
    set({ images: [], files: [], outputs: [] });
  }
}));
export const assetStore = {
  getFile: (id: string) => useAssetStore.getState().files.find(f => f.id === id),
  updateFile: (id: string, patch: Partial<FileAsset>) => useAssetStore.getState().updateFile(id, patch)
};
