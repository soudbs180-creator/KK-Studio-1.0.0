type PayloadRecord = Record<string, unknown>;

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
        const mimeType = firstString(
            getProperty(candidate, 'mime_type'),
            getProperty(candidate, 'mimeType'),
            getProperty(image, 'mime_type'),
            getProperty(image, 'mimeType'),
        ) || 'image/png';
        const cleaned = b64
            .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
            .replace(/\s+/g, '');
        return [`data:${mimeType};base64,${cleaned}`];
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
    return typeof url === 'string' && url.trim() ? [url.trim()] : [];
}

export function extractOpenAICompatibleChatImageUrls(data: unknown): string[] {
    const candidates = collectChatImageCandidates(data);
    if (candidates.length > 0) {
        const bestCandidate = candidates.reduce<PayloadRecord | null>((best, candidate) => {
            if (!best) return candidate;
            return getChatImageCandidateWeight(candidate) > getChatImageCandidateWeight(best) ? candidate : best;
        }, null);
        if (bestCandidate) {
            const extracted = formatChatImageCandidate(bestCandidate);
            if (extracted.length > 0) {
                return extracted;
            }
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
        if (typeof raw !== 'string') return;
        const normalized = raw.trim();
        if (!normalized) return;
        urls.push(normalized);
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
            const mimeType = firstString(
                getProperty(item, 'mime_type'),
                getProperty(item, 'mimeType'),
                getProperty(image, 'mime_type'),
                getProperty(image, 'mimeType'),
            ) || 'image/png';
            const cleaned = b64
                .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
                .replace(/\s+/g, '');
            urls.push(`data:${mimeType};base64,${cleaned}`);
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
            const cleaned = base64Match[2].replace(/\s+/g, '');
            urls.push(`data:${base64Match[1]};base64,${cleaned}`);
        }

        const markdownUrl = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
        if (markdownUrl?.[1]) addUrl(markdownUrl[1]);

        const rawUrl = content.match(/(https?:\/\/[^\s)]+)/);
        if (rawUrl?.[1]) addUrl(rawUrl[1]);
    }

    return Array.from(new Set(urls));
}
