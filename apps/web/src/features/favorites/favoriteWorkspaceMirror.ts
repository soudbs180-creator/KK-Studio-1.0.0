import { fileSystemService } from '../../services/storage/fileSystemService';
import type { FavoriteItem, FavoriteManifest } from './types';

const FAVORITES_DIR = 'favorites';
const ORIGINALS_DIR = 'originals';
const THUMBNAILS_DIR = 'thumbnails';
const MANIFEST_FILE = 'manifest.json';

function sanitizeFileName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80) || 'favorite';
}

function stripRuntimeUrls(item: FavoriteItem): FavoriteItem {
  if (item.kind === 'favorite-image') {
    const { originalObjectUrl, thumbnailObjectUrl, ...rest } = item;
    return rest;
  }

  return item;
}

async function writeBlob(dir: FileSystemDirectoryHandle, filename: string, blob: Blob): Promise<void> {
  // @ts-ignore
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  // @ts-ignore
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function removeEntryIfExists(dir: FileSystemDirectoryHandle, entryName: string): Promise<void> {
  try {
    // @ts-ignore
    await dir.removeEntry(entryName);
  } catch {
    // ignore missing mirror entries
  }
}

function extensionFromMimeType(mimeType?: string): string {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('png')) return 'png';
  return 'png';
}

export async function mirrorFavoritesToWorkspace(params: {
  items: FavoriteItem[];
  originalBlobsByKey?: Map<string, Blob>;
  thumbnailBlobsByKey?: Map<string, Blob>;
}): Promise<void> {
  const handle = fileSystemService.getGlobalHandle();
  if (!handle) return;

  // @ts-ignore
  const favoritesDir = await handle.getDirectoryHandle(FAVORITES_DIR, { create: true });
  // @ts-ignore
  const originalsDir = await favoritesDir.getDirectoryHandle(ORIGINALS_DIR, { create: true });
  // @ts-ignore
  const thumbnailsDir = await favoritesDir.getDirectoryHandle(THUMBNAILS_DIR, { create: true });

  const manifest: FavoriteManifest = {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: params.items.map(stripRuntimeUrls),
  };

  // @ts-ignore
  const manifestHandle = await favoritesDir.getFileHandle(MANIFEST_FILE, { create: true });
  // @ts-ignore
  const manifestWritable = await manifestHandle.createWritable();
  await manifestWritable.write(JSON.stringify(manifest, null, 2));
  await manifestWritable.close();

  for (const item of params.items) {
    if (item.kind !== 'favorite-image') continue;

    const ext = extensionFromMimeType(item.mimeType);
    const base = `${sanitizeFileName(item.name)}_${item.id}`;

    if (item.originalBlobKey) {
      const blob = params.originalBlobsByKey?.get(item.originalBlobKey);
      if (blob) {
        await writeBlob(originalsDir, `${base}.${extensionFromMimeType(blob.type || item.mimeType) || ext}`, blob);
      }
    }

    if (item.thumbnailBlobKey) {
      const blob = params.thumbnailBlobsByKey?.get(item.thumbnailBlobKey);
      if (blob) {
        await writeBlob(thumbnailsDir, `${base}.${extensionFromMimeType(blob.type || item.mimeType) || ext}`, blob);
      }
    }
  }
}

export async function removeFavoriteMirror(item: FavoriteItem): Promise<void> {
  const handle = fileSystemService.getGlobalHandle();
  if (!handle || item.kind !== 'favorite-image') return;

  try {
    // @ts-ignore
    const favoritesDir = await handle.getDirectoryHandle(FAVORITES_DIR);
    // @ts-ignore
    const originalsDir = await favoritesDir.getDirectoryHandle(ORIGINALS_DIR);
    // @ts-ignore
    const thumbnailsDir = await favoritesDir.getDirectoryHandle(THUMBNAILS_DIR);
    const base = `${sanitizeFileName(item.name)}_${item.id}`;
    const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4'];

    await Promise.all(extensions.flatMap((ext) => [
      removeEntryIfExists(originalsDir, `${base}.${ext}`),
      removeEntryIfExists(thumbnailsDir, `${base}.${ext}`),
    ]));
  } catch {
    // best-effort mirror cleanup
  }
}
