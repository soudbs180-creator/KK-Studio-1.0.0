type EcommerceDropLikeFile = Pick<File, 'name' | 'type'>;

const ECOMMERCE_REQUIREMENT_EXTENSIONS = new Set([
  '.xlsx',
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.md',
]);

const ECOMMERCE_REQUIREMENT_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
]);

export type EcommerceDropRouting<T extends EcommerceDropLikeFile = EcommerceDropLikeFile> = {
  requirementFiles: T[];
  productFiles: T[];
  promptReferenceFiles: T[];
  ignoredFiles: T[];
};

function getFileExtension(name: string | undefined): string {
  const normalizedName = String(name || '').trim().toLowerCase();
  const dotIndex = normalizedName.lastIndexOf('.');
  return dotIndex >= 0 ? normalizedName.slice(dotIndex) : '';
}

export function isEcommerceRequirementFile(file: EcommerceDropLikeFile): boolean {
  const normalizedType = String(file.type || '').trim().toLowerCase();
  if (ECOMMERCE_REQUIREMENT_MIME_TYPES.has(normalizedType)) {
    return true;
  }

  return ECOMMERCE_REQUIREMENT_EXTENSIONS.has(getFileExtension(file.name));
}

export function routeEcommerceDroppedFiles<T extends EcommerceDropLikeFile>(
  files: readonly T[],
  options: { analysisConfirmed: boolean },
): EcommerceDropRouting<T> {
  const requirementFiles: T[] = [];
  const droppedImageFiles: T[] = [];
  const ignoredFiles: T[] = [];

  files.forEach((file) => {
    if (isEcommerceRequirementFile(file)) {
      requirementFiles.push(file);
      return;
    }

    if (String(file.type || '').trim().toLowerCase().startsWith('image/')) {
      droppedImageFiles.push(file);
      return;
    }

    ignoredFiles.push(file);
  });

  return {
    requirementFiles,
    productFiles: options.analysisConfirmed ? [] : droppedImageFiles,
    promptReferenceFiles: options.analysisConfirmed ? droppedImageFiles : [],
    ignoredFiles,
  };
}
