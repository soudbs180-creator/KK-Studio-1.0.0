import { getOcrServiceSettings } from './ocrServiceSettings.ts';

export type NutrientDocumentOperation = 'convert-to-pdf' | 'extract-text' | 'ocr-to-pdf';

export interface NutrientBinaryResult {
    blob: Blob;
    contentType: string;
    fileName: string;
}

export interface NutrientTextResult {
    contentType: string;
    fileName: string;
    text: string;
}

export interface NutrientRequestOptions {
    fileName?: string;
}

export interface NutrientOcrOptions extends NutrientRequestOptions {
    language?: string;
}

const DEFAULT_OCR_LANGUAGE = 'chi_sim';
const DOCUMENT_ENDPOINT = '/api/nutrient-document';

const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/html': 'html',
    'text/plain': 'txt',
};

const trimFileName = (value: string) =>
    String(value || '')
        .trim()
        .split(/[\\/]/)
        .pop()
        ?.replace(/[^\w.\-() ]+/g, '_') || '';

const getExtensionFromContentType = (contentType: string) => {
    const normalized = String(contentType || '').split(';')[0].trim().toLowerCase();
    return CONTENT_TYPE_TO_EXTENSION[normalized];
};

const inferUploadFileName = (file: Blob | File, fallbackName: string) => {
    if (typeof File !== 'undefined' && file instanceof File && file.name) {
        return trimFileName(file.name) || fallbackName;
    }

    const inferredExtension = getExtensionFromContentType(file.type);
    if (!inferredExtension) {
        return fallbackName;
    }

    const baseName = fallbackName.replace(/\.[^.]+$/, '') || 'document';
    return `${baseName}.${inferredExtension}`;
};

const createUploadFile = (file: Blob | File, fileName?: string) => {
    if (typeof File !== 'undefined' && file instanceof File && !fileName) {
        return file;
    }

    const resolvedFileName = trimFileName(fileName || inferUploadFileName(file, 'document.bin')) || 'document.bin';
    return new File([file], resolvedFileName, {
        type: file.type || 'application/octet-stream',
    });
};

const parseContentDispositionFileName = (headerValue: string | null) => {
    if (!headerValue) return undefined;

    const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        try {
            return trimFileName(decodeURIComponent(utf8Match[1]));
        } catch {
            return trimFileName(utf8Match[1]);
        }
    }

    const basicMatch = headerValue.match(/filename="?([^"]+)"?/i);
    if (basicMatch?.[1]) {
        return trimFileName(basicMatch[1]);
    }

    return undefined;
};

const replaceFileExtension = (fileName: string, extension: string) => {
    const normalizedName = trimFileName(fileName) || 'document';
    const cleanExtension = extension.startsWith('.') ? extension : `.${extension}`;
    const withoutExtension = normalizedName.replace(/\.[^.]+$/, '') || 'document';
    return `${withoutExtension}${cleanExtension}`;
};

const getFallbackResponseFileName = (
    operation: NutrientDocumentOperation,
    originalFileName: string,
) => (operation === 'extract-text'
    ? replaceFileExtension(originalFileName, '.txt')
    : replaceFileExtension(originalFileName, '.pdf'));

const readErrorMessage = async (response: Response) => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        try {
            const payload = await response.json() as Record<string, unknown>;
            return String(payload.error || payload.message || 'Document processing failed.');
        } catch {
            return 'Document processing failed.';
        }
    }

    const rawText = (await response.text()).trim();
    return rawText || 'Document processing failed.';
};

class NutrientDocumentService {
    private async request(
        operation: NutrientDocumentOperation,
        source: Blob | File,
        options: NutrientRequestOptions & { ocrLanguage?: string } = {},
    ) {
        const upload = createUploadFile(source, options.fileName);
        const formData = new FormData();
        formData.append('operation', operation);
        formData.append('file', upload, upload.name);

        if (operation === 'ocr-to-pdf') {
            const ocrSettings = getOcrServiceSettings();
            formData.append('ocrLanguage', options.ocrLanguage || ocrSettings.defaultLanguage || DEFAULT_OCR_LANGUAGE);
        }

        const response = await fetch(DOCUMENT_ENDPOINT, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(await readErrorMessage(response));
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const responseFileName = parseContentDispositionFileName(response.headers.get('content-disposition'))
            || getFallbackResponseFileName(operation, upload.name);

        return {
            response,
            contentType,
            responseFileName,
        };
    }

    async convertDocumentToPdf(
        source: Blob | File,
        options: NutrientRequestOptions = {},
    ): Promise<NutrientBinaryResult> {
        const { response, contentType, responseFileName } = await this.request('convert-to-pdf', source, options);
        return {
            blob: await response.blob(),
            contentType,
            fileName: responseFileName,
        };
    }

    async convertDocxToPdf(
        source: Blob | File,
        options: NutrientRequestOptions = {},
    ): Promise<NutrientBinaryResult> {
        return this.convertDocumentToPdf(source, {
            ...options,
            fileName: options.fileName || inferUploadFileName(source, 'document.docx'),
        });
    }

    async extractTextFromPdf(
        source: Blob | File,
        options: NutrientRequestOptions = {},
    ): Promise<NutrientTextResult> {
        const { response, contentType, responseFileName } = await this.request('extract-text', source, {
            ...options,
            fileName: options.fileName || inferUploadFileName(source, 'document.pdf'),
        });

        return {
            contentType,
            fileName: responseFileName,
            text: await response.text(),
        };
    }

    async runOcrOnPdf(
        source: Blob | File,
        options: NutrientOcrOptions = {},
    ): Promise<NutrientBinaryResult> {
        const { response, contentType, responseFileName } = await this.request('ocr-to-pdf', source, {
            ...options,
            fileName: options.fileName || inferUploadFileName(source, 'document.pdf'),
            ocrLanguage: options.language,
        });

        return {
            blob: await response.blob(),
            contentType,
            fileName: responseFileName,
        };
    }
}

export const nutrientDocumentService = new NutrientDocumentService();
