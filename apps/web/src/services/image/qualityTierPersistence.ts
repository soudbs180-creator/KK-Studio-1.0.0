/**
 * 图片质量档位持久化
 *
 * 生成并写入 MICRO / THUMBNAIL / PREVIEW 三档派生资源。优先走 Web Worker 压缩，
 * Worker 不可用时回退主线程。
 *
 * THUMBNAIL 档位是 0.35~0.8 缩放区间的默认档位，也是 thumbnail-preferred 卡片的
 * 主力档位。该档位若缺失，读取会全部 miss 并回落到整张原图解码，表现为“已有 ID
 * 却预览很慢”。因此这里必须与 MICRO 一同写入。
 */

import { saveImage } from '../storage/imageStorage.ts';
import { fileSystemService } from '../storage/fileSystemService.ts';
import { ImageQuality, QUALITY_CONFIGS, compressImageToQuality, getQualityStorageId } from './imageQuality.ts';

// Worker 预设与 QUALITY_CONFIGS 的对应关系：SMALL = 300px/0.7 = THUMBNAIL。
const WORKER_PRESET_BY_QUALITY = {
    [ImageQuality.MICRO]: 'MICRO',
    [ImageQuality.THUMBNAIL]: 'SMALL',
} as const;

const DERIVED_QUALITIES = [ImageQuality.MICRO, ImageQuality.THUMBNAIL] as const;

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export interface QualityTierPersistenceOptions {
    /** 存储主键（node.storageId || node.id）。 */
    storageId: string;
    /** 压缩源，通常是 apiResultUrl / url / originalUrl 归一化后的结果。 */
    previewSource: string;
    /** 本地磁盘模式下的目录句柄，用于同步落盘缩略图；非本地模式传 null。 */
    localFolderHandle?: FileSystemDirectoryHandle | null;
    /** 主线程回退时把 base64 转 Blob，用于写入本地磁盘。 */
    base64ToBlob: (data: string) => Blob;
}

/**
 * 写入派生档位。任一档位失败不阻断其余档位，失败仅记录不抛出。
 */
export async function persistImageQualityTiers(options: QualityTierPersistenceOptions): Promise<void> {
    const { storageId, previewSource, localFolderHandle, base64ToBlob } = options;

    let microData: string | null = null;
    let microBlob: Blob | null = null;

    try {
        const { generateThumbnailWithPreset } = await import('../../workers/thumbnailService');

        for (const quality of DERIVED_QUALITIES) {
            const { blob } = await generateThumbnailWithPreset(previewSource, WORKER_PRESET_BY_QUALITY[quality]);
            const data = await blobToDataUrl(blob);
            await saveImage(getQualityStorageId(storageId, quality), data);
            if (quality === ImageQuality.MICRO) {
                microBlob = blob;
            }
        }
    } catch (workerError) {
        console.warn('[QualityTiers] Worker unavailable, falling back to main thread:', workerError);
        for (const quality of DERIVED_QUALITIES) {
            const data = await compressImageToQuality(previewSource, QUALITY_CONFIGS[quality]);
            await saveImage(getQualityStorageId(storageId, quality), data);
            if (quality === ImageQuality.MICRO) {
                microData = data;
            }
        }
    }

    if (localFolderHandle) {
        const thumbnailBlob = microBlob ?? (microData ? base64ToBlob(microData) : null);
        if (thumbnailBlob) {
            await fileSystemService.saveThumbnailToHandle(localFolderHandle, storageId, thumbnailBlob);
        }
    }

    // PREVIEW 槽位镜像原始资源，避免预览读取空白。
    await saveImage(getQualityStorageId(storageId, ImageQuality.PREVIEW), previewSource);
}

export default persistImageQualityTiers;
