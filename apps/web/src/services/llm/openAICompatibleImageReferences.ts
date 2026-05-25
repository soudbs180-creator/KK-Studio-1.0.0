import { extractRefImageData } from './LLMAdapter.ts';

export type OpenAICompatibleReferenceImage = string | { data: string; mimeType: string };

export type OpenAICompatibleImageContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

export interface FormatOpenAICompatibleReferenceImageOptions {
    preserveHttpUrl?: boolean;
    defaultMimeType?: string;
}

export function formatOpenAICompatibleReferenceImage(
    ref: OpenAICompatibleReferenceImage,
    options: FormatOpenAICompatibleReferenceImageOptions = {},
): string {
    const { data, mimeType } = extractRefImageData(ref);
    const rawData = String(data || '').trim();

    if (rawData.startsWith('data:')) {
        return rawData;
    }

    if (options.preserveHttpUrl && rawData.startsWith('http')) {
        return rawData;
    }

    return `data:${mimeType || options.defaultMimeType || 'image/png'};base64,${rawData}`;
}

export function formatOpenAICompatibleReferenceImages(
    refs: OpenAICompatibleReferenceImage[],
    options: FormatOpenAICompatibleReferenceImageOptions = {},
): string[] {
    return refs.map((ref) => formatOpenAICompatibleReferenceImage(ref, options));
}

export function buildOpenAICompatibleImageContentParts(
    prompt: string,
    referenceImages: OpenAICompatibleReferenceImage[] | undefined,
): OpenAICompatibleImageContentPart[] {
    const contentParts: OpenAICompatibleImageContentPart[] = [{ type: 'text', text: prompt }];

    if (!referenceImages?.length) {
        return contentParts;
    }

    for (const refImg of referenceImages) {
        contentParts.push({
            type: 'image_url',
            image_url: { url: formatOpenAICompatibleReferenceImage(refImg) },
        });
    }

    return contentParts;
}
