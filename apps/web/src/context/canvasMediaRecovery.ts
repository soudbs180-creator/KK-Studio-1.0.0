import { GenerationMode, type GeneratedImage } from '../types';
import { ImageQuality, getQualityStorageId } from '../services/image/imageQuality.ts';
import { getStrictOriginalImage, saveImage, saveOriginalImage } from '../services/storage/imageStorage.ts';

export type LocalMediaCacheEntry = {
    url?: string;
    originalUrl?: string;
    filename?: string;
};

const normalizeMediaCacheSource = (value?: string | null): string => (
    typeof value === 'string' ? value.trim() : ''
);

const isVideoFileName = (filename?: string | null): boolean => (
    typeof filename === 'string' && /\.(mp4|webm|mov)$/i.test(filename)
);

const isGeneratedMediaVideoLike = (image?: Partial<GeneratedImage> | null): boolean => (
    image?.mode === GenerationMode.VIDEO || image?.mode === GenerationMode.AUDIO
);

export const hydrateRecoveredMediaCacheEntry = async (
    id: string,
    entry?: LocalMediaCacheEntry | null
): Promise<void> => {
    const displayUrl = normalizeMediaCacheSource(entry?.url);
    const originalUrl = normalizeMediaCacheSource(entry?.originalUrl);
    const primaryOriginalSource = originalUrl;

    if (!displayUrl && !primaryOriginalSource) {
        return;
    }

    if (isVideoFileName(entry?.filename)) {
        const videoSource = primaryOriginalSource || displayUrl;
        if (!videoSource) return;
        await saveImage(id, videoSource);
        return;
    }

    // Never promote a thumbnail/display asset into the protected original slot.
    // If disk recovery only found a thumbnail, keep it in the preview tiers and
    // preserve any existing original already stored in IndexedDB/OPFS.
    if (primaryOriginalSource) {
        await saveOriginalImage(id, primaryOriginalSource);
    }

    if (displayUrl) {
        await Promise.allSettled([
            saveImage(getQualityStorageId(id, ImageQuality.MICRO), displayUrl),
            saveImage(getQualityStorageId(id, ImageQuality.THUMBNAIL), displayUrl),
        ]);
    }
};

export const resolveOriginalPersistSourceForDisk = async (
    image: Pick<GeneratedImage, 'id' | 'storageId' | 'originalUrl' | 'apiResultUrl' | 'url' | 'mode'>
): Promise<string | null> => {
    const explicitOriginal = normalizeMediaCacheSource(image.originalUrl)
        || normalizeMediaCacheSource(image.apiResultUrl);
    if (explicitOriginal && !explicitOriginal.startsWith('blob:')) {
        return explicitOriginal;
    }

    const storageId = image.storageId || image.id;
    if (storageId) {
        const cachedOriginal = await getStrictOriginalImage(storageId);
        if (cachedOriginal && !cachedOriginal.startsWith('blob:')) {
            return cachedOriginal;
        }
    }

    if (isGeneratedMediaVideoLike(image)) {
        const stableVideoSource = normalizeMediaCacheSource(image.url);
        return stableVideoSource && !stableVideoSource.startsWith('blob:')
            ? stableVideoSource
            : null;
    }

    return null;
};
