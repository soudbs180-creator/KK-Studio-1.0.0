import { useCallback } from 'react';

import { appendUploadFilesWithinLimit } from '../components/ecommerce/ecommerceImportPreview.ts';
import type { EcommerceAnalysisAsset } from '../services/ecommerce/types';
import type {
  EcommerceEditableTaskState,
  EcommerceImageRef,
  EcommerceTaskAssetRoleBinding,
  ReferenceImage,
} from '../types';

export const MAX_ECOMMERCE_PRODUCT_FILES = 4;
export const MAX_ECOMMERCE_EXTRA_REFERENCE_FILES = 4;
export const MAX_ECOMMERCE_ITEM_REFERENCE_FILES = 6;

const EMPTY_ITEM_REFERENCE_FILES: Record<string, EcommerceManualReferenceBinding[]> = {};

export type EcommerceManualReferenceBinding = {
  assetId: string;
  label: string;
  fileName: string;
  referenceImage: ReferenceImage;
  assetRole: EcommerceTaskAssetRoleBinding;
};

export type EcommerceUploadReferenceBundle = {
  productReferences: ReferenceImage[];
  extraReferences: ReferenceImage[];
  productImageRef?: EcommerceImageRef;
};

export interface EcommerceUploadReferenceState {
  productFiles?: File[];
  extraReferenceFiles?: File[];
  itemReferenceFiles?: Record<string, EcommerceManualReferenceBinding[]>;
}

export type SetEcommerceUploadReferenceState = (
  updater: (previousState: EcommerceUploadReferenceState) => Partial<EcommerceUploadReferenceState> | null
) => void;

export interface UseEcommerceUploadReferenceRuntimeDeps {
  ecommerceState: EcommerceUploadReferenceState;
  setEcommerceUploadReferenceState: SetEcommerceUploadReferenceState;
  readBlobAsDataUrl: (blob: Blob) => Promise<string>;
}

export interface UseEcommerceUploadReferenceRuntimeResult {
  buildProductImageRef: (referenceImage?: ReferenceImage | null) => EcommerceImageRef | undefined;
  buildReferenceImageSignature: (referenceImages: ReferenceImage[]) => string;
  buildEcommerceImageRefSignature: (reference?: EcommerceImageRef) => string;
  buildTaskStateSyncSignature: (taskState?: EcommerceEditableTaskState | null) => string;
  createReferenceImageFromFile: (file: File, labelPrefix: string) => Promise<ReferenceImage>;
  createReferenceImageFromAsset: (asset: EcommerceAnalysisAsset) => ReferenceImage | null;
  buildCurrentEcommerceUploadReferences: () => Promise<EcommerceUploadReferenceBundle>;
  extractEcommerceManualReferenceBindings: (taskStateSeed?: EcommerceEditableTaskState | null) => EcommerceManualReferenceBinding[];
  handlePickEcommerceProductFiles: (files: FileList | File[]) => void;
  handlePickEcommerceExtraReferenceFiles: (files: FileList | File[]) => void;
  handleRemoveEcommerceProductFile: (index: number) => void;
  handleRemoveEcommerceExtraReferenceFile: (index: number) => void;
  handlePickEcommerceItemReferenceFiles: (sourceKey: string, files: FileList | File[]) => Promise<void>;
  handleRemoveEcommerceItemReferenceFile: (sourceKey: string, index: number) => void;
}

export function sanitizeReferenceToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'ref';
}

export function buildUploadReferenceIdentity(file: File, labelPrefix: string): string {
  return `${labelPrefix}-${sanitizeReferenceToken(file.name || labelPrefix)}-${file.size}-${file.lastModified}`;
}

export function filterEcommerceImageFiles(files: FileList | File[]): File[] {
  return Array.from(files || []).filter((file) => file.type.startsWith('image/'));
}

export function buildProductImageRef(referenceImage?: ReferenceImage | null): EcommerceImageRef | undefined {
  return referenceImage
    ? {
        id: referenceImage.id,
        storageId: referenceImage.storageId,
        label: '产品图1',
        mimeType: referenceImage.mimeType,
        url: referenceImage.url,
      }
    : undefined;
}

export function buildReferenceImageSignature(referenceImages: ReferenceImage[]): string {
  return (referenceImages || []).map((referenceImage) => [
    referenceImage.id,
    referenceImage.storageId || '',
    referenceImage.mimeType || '',
    referenceImage.url || '',
    referenceImage.data || '',
  ].join('|')).join('||');
}

export function buildEcommerceImageRefSignature(reference?: EcommerceImageRef): string {
  return reference
    ? [reference.id, reference.storageId || '', reference.label || '', reference.mimeType || '', reference.url || ''].join('|')
    : '';
}

export function buildTaskStateSyncSignature(taskState?: EcommerceEditableTaskState | null): string {
  return JSON.stringify({
    imageRoleSummary: taskState?.imageRoleSummary || [],
    assetRoles: taskState?.assetRoles || [],
    missingFields: taskState?.missingFields || [],
    effectiveSizePolicy: taskState?.effectiveSizePolicy || '',
    effectiveSizeTier: taskState?.effectiveSizeTier || '',
    promptOverride: taskState?.promptOverride || '',
    resolvedPromptPreview: taskState?.resolvedPromptPreview || '',
    displayLabel: taskState?.displayLabel || '',
  });
}

export async function createReferenceImageFromFile(
  file: File,
  labelPrefix: string,
  readBlobAsDataUrl: (blob: Blob) => Promise<string>,
): Promise<ReferenceImage> {
  const dataUrl = await readBlobAsDataUrl(file);
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const referenceIdentity = buildUploadReferenceIdentity(file, labelPrefix);
  return {
    id: referenceIdentity,
    storageId: referenceIdentity,
    data: match?.[2] || '',
    mimeType: match?.[1] || file.type || 'image/png',
    url: dataUrl,
  };
}

export function createReferenceImageFromAsset(asset: EcommerceAnalysisAsset): ReferenceImage | null {
  if (!asset.previewUrl) return null;
  const match = asset.previewUrl.match(/^data:([^;]+);base64,(.+)$/);
  return {
    id: `analysis-${asset.assetId}`,
    storageId: asset.assetId,
    data: match?.[2] || '',
    mimeType: match?.[1] || asset.mimeType || 'image/png',
    url: asset.previewUrl,
  };
}

export function extractEcommerceManualReferenceBindingsFromState(
  state: Pick<EcommerceUploadReferenceState, 'itemReferenceFiles'>,
  taskStateSeed?: EcommerceEditableTaskState | null,
): EcommerceManualReferenceBinding[] {
  if (!taskStateSeed?.sourceRowKey) {
    return [];
  }

  return state.itemReferenceFiles?.[taskStateSeed.sourceRowKey] || [];
}

export function removeEcommerceProductFileFromState(
  state: Pick<EcommerceUploadReferenceState, 'productFiles'>,
  index: number,
): Pick<EcommerceUploadReferenceState, 'productFiles'> | null {
  const productFiles = state.productFiles || [];
  if (index < 0 || index >= productFiles.length) {
    return null;
  }

  return {
    productFiles: productFiles.filter((_, fileIndex) => fileIndex !== index),
  };
}

export function removeEcommerceExtraReferenceFileFromState(
  state: Pick<EcommerceUploadReferenceState, 'extraReferenceFiles'>,
  index: number,
): Pick<EcommerceUploadReferenceState, 'extraReferenceFiles'> | null {
  const extraReferenceFiles = state.extraReferenceFiles || [];
  if (index < 0 || index >= extraReferenceFiles.length) {
    return null;
  }

  return {
    extraReferenceFiles: extraReferenceFiles.filter((_, fileIndex) => fileIndex !== index),
  };
}

export function removeEcommerceItemReferenceFileFromState(
  state: Pick<EcommerceUploadReferenceState, 'itemReferenceFiles'>,
  sourceKey: string,
  index: number,
): Pick<EcommerceUploadReferenceState, 'itemReferenceFiles'> | null {
  const previousBindings = sourceKey ? state.itemReferenceFiles?.[sourceKey] : undefined;
  if (!previousBindings || index < 0 || index >= previousBindings.length) {
    return null;
  }

  const nextBindings = previousBindings.filter((_, bindingIndex) => bindingIndex !== index);
  const itemReferenceFiles = { ...(state.itemReferenceFiles || {}) };
  if (nextBindings.length > 0) {
    itemReferenceFiles[sourceKey] = nextBindings;
  } else {
    delete itemReferenceFiles[sourceKey];
  }

  return { itemReferenceFiles };
}

export function useEcommerceUploadReferenceRuntime({
  ecommerceState,
  setEcommerceUploadReferenceState,
  readBlobAsDataUrl,
}: UseEcommerceUploadReferenceRuntimeDeps): UseEcommerceUploadReferenceRuntimeResult {
  const itemReferenceFiles = ecommerceState.itemReferenceFiles || EMPTY_ITEM_REFERENCE_FILES;

  const createReferenceImageFromFileForRuntime = useCallback((file: File, labelPrefix: string) => (
    createReferenceImageFromFile(file, labelPrefix, readBlobAsDataUrl)
  ), [readBlobAsDataUrl]);

  const buildCurrentEcommerceUploadReferences = useCallback(async (): Promise<EcommerceUploadReferenceBundle> => {
    const productReferences = await Promise.all(
      (ecommerceState.productFiles || [])
        .slice(0, MAX_ECOMMERCE_PRODUCT_FILES)
        .map((file, index) => createReferenceImageFromFileForRuntime(file, `product-${index + 1}`)),
    );
    const extraReferences = await Promise.all(
      (ecommerceState.extraReferenceFiles || [])
        .slice(0, MAX_ECOMMERCE_EXTRA_REFERENCE_FILES)
        .map((file, index) => createReferenceImageFromFileForRuntime(file, `extra-${index + 1}`)),
    );

    return {
      productReferences,
      extraReferences,
      productImageRef: buildProductImageRef(productReferences[0]),
    };
  }, [createReferenceImageFromFileForRuntime, ecommerceState.extraReferenceFiles, ecommerceState.productFiles]);

  const extractEcommerceManualReferenceBindings = useCallback((taskStateSeed?: EcommerceEditableTaskState | null) => (
    extractEcommerceManualReferenceBindingsFromState({ itemReferenceFiles }, taskStateSeed)
  ), [itemReferenceFiles]);

  const handlePickEcommerceProductFiles = useCallback((files: FileList | File[]) => {
    const nextFiles = filterEcommerceImageFiles(files);
    if (nextFiles.length === 0) return;
    setEcommerceUploadReferenceState((previousState) => ({
      productFiles: appendUploadFilesWithinLimit(
        previousState.productFiles || [],
        nextFiles,
        MAX_ECOMMERCE_PRODUCT_FILES,
      ),
    }));
  }, [setEcommerceUploadReferenceState]);

  const handlePickEcommerceExtraReferenceFiles = useCallback((files: FileList | File[]) => {
    const nextFiles = filterEcommerceImageFiles(files);
    if (nextFiles.length === 0) return;
    setEcommerceUploadReferenceState((previousState) => ({
      extraReferenceFiles: appendUploadFilesWithinLimit(
        previousState.extraReferenceFiles || [],
        nextFiles,
        MAX_ECOMMERCE_EXTRA_REFERENCE_FILES,
      ),
    }));
  }, [setEcommerceUploadReferenceState]);

  const handleRemoveEcommerceProductFile = useCallback((index: number) => {
    setEcommerceUploadReferenceState((previousState) => removeEcommerceProductFileFromState(previousState, index));
  }, [setEcommerceUploadReferenceState]);

  const handleRemoveEcommerceExtraReferenceFile = useCallback((index: number) => {
    setEcommerceUploadReferenceState((previousState) => removeEcommerceExtraReferenceFileFromState(previousState, index));
  }, [setEcommerceUploadReferenceState]);

  const handlePickEcommerceItemReferenceFiles = useCallback(async (sourceKey: string, files: FileList | File[]) => {
    const nextFiles = filterEcommerceImageFiles(files);
    if (!sourceKey || nextFiles.length === 0) {
      return;
    }

    const manualReferenceBindings = await Promise.all(
      nextFiles.map(async (file, index) => {
        const referenceImage = await createReferenceImageFromFileForRuntime(file, `item-${sourceKey}-${index + 1}`);
        const assetId = referenceImage.storageId || referenceImage.id;
        const label = `手动参考图${index + 1}`;

        return {
          assetId,
          label,
          fileName: file.name,
          referenceImage,
          assetRole: {
            assetId,
            role: 'reference' as const,
            label,
            normalizedLabel: label,
            source: 'upload' as const,
            note: '用户手动补传到当前需求的参考图',
          },
        } satisfies EcommerceManualReferenceBinding;
      }),
    );

    setEcommerceUploadReferenceState((previousState) => {
      const previousBindings = previousState.itemReferenceFiles?.[sourceKey] || [];
      return {
        itemReferenceFiles: {
          ...(previousState.itemReferenceFiles || {}),
          [sourceKey]: [
            ...previousBindings,
            ...manualReferenceBindings,
          ].slice(0, MAX_ECOMMERCE_ITEM_REFERENCE_FILES),
        },
      };
    });
  }, [createReferenceImageFromFileForRuntime, setEcommerceUploadReferenceState]);

  const handleRemoveEcommerceItemReferenceFile = useCallback((sourceKey: string, index: number) => {
    setEcommerceUploadReferenceState((previousState) => removeEcommerceItemReferenceFileFromState(previousState, sourceKey, index));
  }, [setEcommerceUploadReferenceState]);

  return {
    buildProductImageRef,
    buildReferenceImageSignature,
    buildEcommerceImageRefSignature,
    buildTaskStateSyncSignature,
    createReferenceImageFromFile: createReferenceImageFromFileForRuntime,
    createReferenceImageFromAsset,
    buildCurrentEcommerceUploadReferences,
    extractEcommerceManualReferenceBindings,
    handlePickEcommerceProductFiles,
    handlePickEcommerceExtraReferenceFiles,
    handleRemoveEcommerceProductFile,
    handleRemoveEcommerceExtraReferenceFile,
    handlePickEcommerceItemReferenceFiles,
    handleRemoveEcommerceItemReferenceFile,
  };
}
