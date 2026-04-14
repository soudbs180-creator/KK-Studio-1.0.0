export type EcommerceUploadFileLike = Pick<File, 'name' | 'type'>;

export interface EcommerceUploadPreviewItem {
  id: string;
  fileName: string;
  displayLabel: string;
}

export interface EcommerceUploadPreviewModel {
  productName: string;
  productNameSource: 'analysis' | 'file-name' | null;
  productItems: EcommerceUploadPreviewItem[];
  extraReferenceItems: EcommerceUploadPreviewItem[];
}

const TRAILING_GENERIC_PATTERNS = [
  /\b(image|img|photo|picture|pic|screenshot|reference|ref|product|scene|detail|main|hero|wechat|weixin|copy|final|edited?)\b\s*\d*$/i,
  /[\s_-]*\d{1,3}$/i,
];

function normalizeWhitespace(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim();
}

export function inferUploadDisplayLabel(fileName: string): string {
  let candidate = normalizeWhitespace(stripExtension(fileName).replace(/[()[\]{}]+/g, ' '));

  for (const pattern of TRAILING_GENERIC_PATTERNS) {
    candidate = candidate.replace(pattern, '').trim();
  }

  candidate = normalizeWhitespace(candidate);
  return candidate || normalizeWhitespace(stripExtension(fileName)) || fileName.trim();
}

export function removeUploadFileAtIndex<T>(files: readonly T[], indexToRemove: number): T[] {
  return files.filter((_, index) => index !== indexToRemove);
}

export function appendUploadFilesWithinLimit<T>(
  existingFiles: readonly T[],
  incomingFiles: readonly T[],
  maxCount: number,
): T[] {
  return [...existingFiles, ...incomingFiles].slice(0, maxCount);
}

function buildUploadPreviewItems(
  files: EcommerceUploadFileLike[],
  prefix: 'product' | 'extra',
): EcommerceUploadPreviewItem[] {
  return files.map((file, index) => ({
    id: `${prefix}-${index + 1}`,
    fileName: file.name,
    displayLabel: inferUploadDisplayLabel(file.name),
  }));
}

export function buildEcommerceUploadPreviewModel(input: {
  analyzedProductName?: string;
  productFiles: EcommerceUploadFileLike[];
  extraReferenceFiles: EcommerceUploadFileLike[];
}): EcommerceUploadPreviewModel {
  const productItems = buildUploadPreviewItems(input.productFiles, 'product');
  const extraReferenceItems = buildUploadPreviewItems(input.extraReferenceFiles, 'extra');
  const analyzedProductName = String(input.analyzedProductName || '').trim();

  if (analyzedProductName) {
    return {
      productName: analyzedProductName,
      productNameSource: 'analysis',
      productItems,
      extraReferenceItems,
    };
  }

  const fallbackProductName = productItems[0]?.displayLabel || extraReferenceItems[0]?.displayLabel || '';

  return {
    productName: fallbackProductName,
    productNameSource: fallbackProductName ? 'file-name' : null,
    productItems,
    extraReferenceItems,
  };
}
