const SENSITIVE_PREVIEW_FIELD_NAMES = new Set([
    'authorization',
    'api_key',
    'apikey',
    'token',
    'secret',
    'key',
]);

const PROMPT_PREVIEW_FIELD_NAMES = new Set([
    'content',
    'input',
    'message',
    'messages',
    'negative_prompt',
    'original_prompt',
    'prompt',
    'prompts',
    'raw_prompt',
    'raw_prompt_original',
    'text',
]);

function isSensitivePreviewField(fieldName: string): boolean {
    return SENSITIVE_PREVIEW_FIELD_NAMES.has(String(fieldName || '').toLowerCase());
}

function isPromptPreviewField(fieldName: string): boolean {
    return PROMPT_PREVIEW_FIELD_NAMES.has(String(fieldName || '').toLowerCase());
}

function redactPreviewValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redactPreviewValue);

    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
            if (isSensitivePreviewField(key)) {
                out[key] = '<omitted:sensitive>';
                return;
            }
            if (isPromptPreviewField(key)) {
                out[key] = '<omitted:prompt>';
                return;
            }
            out[key] = redactPreviewValue(entryValue);
        });
        return out;
    }

    if (typeof value === 'string') {
        if (value.startsWith('data:')) return '<omitted:data-uri>';
        if (/^https?:\/\//i.test(value) && value.length > 120) return '<omitted:url>';
        if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 200) return '<omitted:base64>';
        if (value.length > 400) return `${value.slice(0, 200)}...<truncated>`;
        return value;
    }

    return value;
}

export function buildSafeRequestBodyPreview(body: unknown): string {
    try {
        return JSON.stringify(redactPreviewValue(body), null, 2);
    } catch {
        return '{\n  "error": "preview_unavailable"\n}';
    }
}

function buildSafeFormDataEntryPreview(key: string, value: FormDataEntryValue): unknown {
    if (isSensitivePreviewField(key)) {
        return '<omitted:sensitive>';
    }
    if (isPromptPreviewField(key)) {
        return '<omitted:prompt>';
    }

    if (typeof Blob !== 'undefined' && value instanceof Blob) {
        const fileName = typeof File !== 'undefined' && value instanceof File ? value.name : undefined;
        return {
            kind: 'blob',
            type: value.type || 'application/octet-stream',
            size: value.size,
            ...(fileName ? { name: fileName } : {}),
        };
    }

    if (typeof value === 'string') {
        return redactPreviewValue(value);
    }

    return String(value);
}

export function buildSafeFormDataPreview(formData: FormData): string {
    const preview: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
        const safeValue = buildSafeFormDataEntryPreview(key, value);

        if (preview[key] === undefined) {
            preview[key] = safeValue;
        } else if (Array.isArray(preview[key])) {
            preview[key].push(safeValue);
        } else {
            preview[key] = [preview[key], safeValue];
        }
    }

    return JSON.stringify(preview, null, 2);
}
