type PayloadRecord = Record<string, unknown>;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/bmp',
]);

function isRecord(value: unknown): value is PayloadRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getProperty(value: unknown, key: string): unknown {
    if (Array.isArray(value) && /^\d+$/.test(key)) {
        return value[Number(key)];
    }
    return isRecord(value) ? value[key] : undefined;
}

function getPath(value: unknown, path: string[]): unknown {
    return path.reduce<unknown>((current, key) => getProperty(current, key), value);
}

function getString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function firstString(...values: unknown[]): string | undefined {
    for (const value of values) {
        if (typeof value === 'string') return value;
    }
    return undefined;
}

function resolveAllowedImageMimeType(raw: unknown): string | undefined {
    const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!normalized) return undefined;
    if (normalized === 'image/jpg') return 'image/jpeg';
    return ALLOWED_IMAGE_MIME_TYPES.has(normalized) ? normalized : undefined;
}

function normalizeBase64ImageMimeType(...values: unknown[]): string {
    for (const value of values) {
        const mimeType = resolveAllowedImageMimeType(value);
        if (mimeType) return mimeType;
    }
    return 'image/png';
}

function formatBase64ImageDataUrl(rawBase64: string, ...mimeValues: unknown[]): string[] {
    const normalizedBase64 = rawBase64.trim();
    if (!normalizedBase64) return [];

    const dataUrlMatch = normalizedBase64.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
    if (dataUrlMatch) {
        const mimeType = resolveAllowedImageMimeType(dataUrlMatch[1]);
        if (!mimeType) return [];
        const cleaned = dataUrlMatch[2].replace(/\s+/g, '');
        return cleaned ? [`data:${mimeType};base64,${cleaned}`] : [];
    }

    const cleaned = normalizedBase64.replace(/\s+/g, '');
    if (!cleaned) return [];

    return [`data:${normalizeBase64ImageMimeType(...mimeValues)};base64,${cleaned}`];
}

function normalizeImageUrl(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const normalized = raw.trim();
    if (!normalized) return undefined;

    if (/^https?:\/\//i.test(normalized)) {
        try {
            const parsed = new URL(normalized);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? normalized : undefined;
        } catch {
            return undefined;
        }
    }

    const dataUrlMatch = normalized.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
    if (!dataUrlMatch) return undefined;

    const mimeType = resolveAllowedImageMimeType(dataUrlMatch[1]);
    if (!mimeType) return undefined;

    const cleaned = dataUrlMatch[2].replace(/\s+/g, '');
    return cleaned ? `data:${mimeType};base64,${cleaned}` : undefined;
}

function collectChatImageCandidates(data: unknown): PayloadRecord[] {
    const candidates: PayloadRecord[] = [];
    const pushCandidates = (value: unknown): void => {
        if (!Array.isArray(value)) return;
        value.forEach((item) => {
            if (isRecord(item)) {
                candidates.push(item);
            }
        });
    };

    pushCandidates(getPath(data, ['choices', '0', 'message', 'images']));
    pushCandidates(getProperty(data, 'images'));
    pushCandidates(getProperty(data, 'data'));

    return candidates;
}

function getChatImageCandidateWeight(candidate: PayloadRecord): number {
    const image = getProperty(candidate, 'image');
    return [
        getProperty(candidate, 'b64_json'),
        getProperty(candidate, 'url'),
        getProperty(image, 'b64_json'),
        getProperty(image, 'url'),
    ].reduce<number>((total, value) => total + (typeof value === 'string' ? value.length : 0), 0);
}

function formatChatImageCandidate(candidate: PayloadRecord): string[] {
    const image = getProperty(candidate, 'image');
    const b64 = firstString(
        getProperty(candidate, 'b64_json'),
        getProperty(candidate, 'b64'),
        getProperty(candidate, 'base64'),
        getProperty(candidate, 'image_base64'),
        getProperty(image, 'b64_json'),
    );
    if (typeof b64 === 'string' && b64.trim()) {
        return formatBase64ImageDataUrl(
            b64,
            getProperty(candidate, 'mime_type'),
            getProperty(candidate, 'mimeType'),
            getProperty(image, 'mime_type'),
            getProperty(image, 'mimeType'),
        );
    }

    const url = firstString(
        getProperty(candidate, 'hd_url'),
        getProperty(candidate, 'original_url'),
        getProperty(candidate, 'full_url'),
        getProperty(candidate, 'image_url'),
        getProperty(candidate, 'url'),
        getProperty(candidate, 'uri'),
        getProperty(candidate, 'src'),
        getProperty(image, 'url'),
        getProperty(image, 'image_url'),
    );
    const normalizedUrl = normalizeImageUrl(url);
    return normalizedUrl ? [normalizedUrl] : [];
}

export function extractOpenAICompatibleChatImageUrls(data: unknown): string[] {
    const candidates = collectChatImageCandidates(data);
    if (candidates.length > 0) {
        let bestExtracted: { urls: string[]; weight: number } | null = null;
        for (const candidate of candidates) {
            const urls = formatChatImageCandidate(candidate);
            if (urls.length === 0) continue;
            const weight = getChatImageCandidateWeight(candidate);
            if (!bestExtracted || weight > bestExtracted.weight) {
                bestExtracted = { urls, weight };
            }
        }
        if (bestExtracted) {
            return bestExtracted.urls;
        }
    }

    const content = firstString(
        getPath(data, ['choices', '0', 'message', 'content']),
        getProperty(data, 'message'),
        getProperty(data, 'output_text'),
    ) || '';
    if (typeof content === 'string' && content.trim()) {
        return extractImageUrlsFromPayload({ choices: [{ message: { content } }] });
    }

    return [];
}

export function extractImageUrlsFromPayload(data: unknown): string[] {
    const candidates: unknown[] = [];
    const pushAny = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(pushAny);
        else if (value !== undefined && value !== null) candidates.push(value);
    };

    pushAny(getProperty(data, 'data'));
    pushAny(getPath(data, ['data', 'data']));
    pushAny(getPath(data, ['data', 'result']));
    pushAny(getPath(data, ['data', 'output']));
    pushAny(getPath(data, ['data', 'images']));
    pushAny(getPath(data, ['data', 'urls']));
    pushAny(getPath(data, ['data', 'outputs']));
    pushAny(getProperty(data, 'images'));
    pushAny(getPath(data, ['result', 'data']));
    pushAny(getPath(data, ['result', 'data', 'data']));
    pushAny(getPath(data, ['result', 'images']));
    pushAny(getPath(data, ['result', 'result']));
    pushAny(getPath(data, ['result', 'urls']));
    pushAny(getPath(data, ['result', 'outputs']));
    pushAny(getPath(data, ['output', 'data']));
    pushAny(getPath(data, ['output', 'data', 'data']));
    pushAny(getPath(data, ['output', 'images']));
    pushAny(getPath(data, ['output', 'result']));
    pushAny(getPath(data, ['output', 'urls']));
    pushAny(getPath(data, ['output', 'outputs']));

    const directUrl = getString(getProperty(data, 'url'));
    const dataUrl = getString(getPath(data, ['data', 'url']));
    const resultUrl = getString(getPath(data, ['result', 'url']));
    const outputUrl = getString(getPath(data, ['output', 'url']));
    const outputImageUrl = getString(getPath(data, ['output', 'image_url']));
    if (directUrl) candidates.push({ url: directUrl });
    if (dataUrl) candidates.push({ url: dataUrl });
    if (resultUrl) candidates.push({ url: resultUrl });
    if (outputUrl) candidates.push({ url: outputUrl });
    if (outputImageUrl) candidates.push({ url: outputImageUrl });

    const urls: string[] = [];
    const addUrl = (raw: unknown): void => {
        const normalized = normalizeImageUrl(raw);
        if (normalized) urls.push(normalized);
    };

    candidates.forEach((item) => {
        if (typeof item === 'string') {
            addUrl(item);
            return;
        }
        if (!isRecord(item)) return;

        const image = getProperty(item, 'image');
        const b64 = firstString(
            getProperty(item, 'b64_json'),
            getProperty(item, 'b64'),
            getProperty(item, 'base64'),
            getProperty(item, 'image_base64'),
            getProperty(image, 'b64_json'),
        );
        if (typeof b64 === 'string' && b64.trim()) {
            urls.push(...formatBase64ImageDataUrl(
                b64,
                getProperty(item, 'mime_type'),
                getProperty(item, 'mimeType'),
                getProperty(image, 'mime_type'),
                getProperty(image, 'mimeType'),
            ));
            return;
        }

        pushAny(getProperty(item, 'urls'));
        pushAny(getProperty(item, 'images'));
        pushAny(getProperty(item, 'outputs'));
        pushAny(getProperty(item, 'output'));
        pushAny(getProperty(item, 'result'));
        pushAny(getProperty(item, 'data'));

        addUrl(getProperty(item, 'hd_url'));
        addUrl(getProperty(item, 'original_url'));
        addUrl(getProperty(item, 'full_url'));
        addUrl(getProperty(item, 'image_url'));
        addUrl(getProperty(item, 'url'));
        addUrl(getProperty(item, 'uri'));
        addUrl(getProperty(item, 'src'));
    });

    const content = firstString(
        getPath(data, ['choices', '0', 'message', 'content']),
        getProperty(data, 'message'),
        getProperty(data, 'output_text'),
    ) || '';
    if (typeof content === 'string' && content.trim()) {
        const base64Match = content.match(/data:(image\/[^;]+);base64,([A-Za-z0-9+/=\\s]+)/);
        if (base64Match?.[2]) {
            urls.push(...formatBase64ImageDataUrl(`data:${base64Match[1]};base64,${base64Match[2]}`));
        }

        const markdownUrl = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
        if (markdownUrl?.[1]) addUrl(markdownUrl[1]);

        const rawUrl = content.match(/(https?:\/\/[^\s)]+)/);
        if (rawUrl?.[1]) addUrl(rawUrl[1]);
    }

    return Array.from(new Set(urls));
}
