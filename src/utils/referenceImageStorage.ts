import type { ReferenceImage } from '../types';

type ReferenceImageLike = Partial<Pick<ReferenceImage, 'id' | 'storageId' | 'data' | 'mimeType' | 'url'>>;

export const getReferenceImageLookupIds = (image?: ReferenceImageLike | null): string[] => {
    if (!image) return [];

    const ids: string[] = [];
    const storageId = typeof image.storageId === 'string' ? image.storageId.trim() : '';
    const id = typeof image.id === 'string' ? image.id.trim() : '';

    if (storageId) ids.push(storageId);
    if (id && id !== storageId) ids.push(id);

    return ids;
};

export const getPrimaryReferenceImageStorageId = (image?: ReferenceImageLike | null): string | undefined => (
    getReferenceImageLookupIds(image)[0]
);

export const normalizeReferenceImageStorage = <T extends { id: string; storageId?: string }>(image: T): T => (
    image.storageId ? image : { ...image, storageId: image.id }
);

export const normalizeReferenceImagesStorage = <T extends { id: string; storageId?: string }>(
    images?: T[] | null,
): T[] | undefined => (
    images?.map((image) => normalizeReferenceImageStorage(image))
);

export const toReferenceImageDataUrl = (data?: string | null, mimeType?: string): string => {
    const normalized = typeof data === 'string' ? data.trim() : '';
    if (!normalized) return '';

    if (
        normalized.startsWith('data:')
        || normalized.startsWith('blob:')
        || normalized.startsWith('http://')
        || normalized.startsWith('https://')
    ) {
        return normalized;
    }

    return `data:${mimeType || 'image/png'};base64,${normalized}`;
};
