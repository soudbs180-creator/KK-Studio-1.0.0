import React from 'react';

import type { GeneratedImage, ReferenceImage } from '../types';
import { getReferenceImageLookupIds, toReferenceImageDataUrl } from '../utils/referenceImageStorage';

interface UseGenerationReferenceImagesArgs {
  activeSourceImage: string | null;
  imageNodesById: Map<string, GeneratedImage>;
}

export function useGenerationReferenceImages({
  activeSourceImage,
  imageNodesById,
}: UseGenerationReferenceImagesArgs) {
  return React.useCallback((referenceImages: ReferenceImage[]) => {
    const finalReferenceImages = referenceImages.map((image) => ({ ...image }));

    if (activeSourceImage) {
      const sourceImage = imageNodesById.get(activeSourceImage);
      const alreadyAdded = finalReferenceImages.some((referenceImage) => referenceImage.id === sourceImage?.id);
      if (sourceImage && !alreadyAdded) {
        finalReferenceImages.push({
          id: sourceImage.id,
          data: '',
          storageId: sourceImage.storageId || sourceImage.id,
          mimeType: 'image/png',
        });
      }
    }

    finalReferenceImages.forEach((referenceImage) => {
      if (!referenceImage.data) {
        return;
      }

      import('../services/storage/imageStorage').then(({ saveImage }) => {
        const fullUrl = toReferenceImageDataUrl(referenceImage.data, referenceImage.mimeType || 'image/png');
        const lookupIds = getReferenceImageLookupIds(referenceImage);
        Promise.allSettled(lookupIds.map((lookupId) => saveImage(lookupId, fullUrl)))
          .catch((error) => console.warn('Ref save failed', error));
      });
    });

    return finalReferenceImages;
  }, [activeSourceImage, imageNodesById]);
}
