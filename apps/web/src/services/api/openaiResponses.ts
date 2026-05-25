type OpenAICompatibleMessage = {
    role?: string;
    content: unknown;
};

type InlineDataPart = {
    mimeType: string;
    data: string;
};

type ResponsesContentPart = {
    type: string;
    text?: string;
    image_url?: string;
};

const RESPONSE_ONLY_MODEL_PATTERNS = [
    /^o3-pro$/i,
    /^codex-mini-latest$/i,
    /^o3-deep-research(?:-[\d-]+)?$/i,
];

function normalizeModelId(modelId?: string): string {
    return String(modelId || '').trim().split('@')[0].toLowerCase();
}

function pushText(parts: string[], value: unknown): void {
    if (typeof value !== 'string') return;
    const normalized = value.trim();
    if (normalized) {
        parts.push(normalized);
    }
}

function normalizeResponsesContent(content: unknown): ResponsesContentPart[] {
    if (Array.isArray(content)) {
        const normalizedParts: ResponsesContentPart[] = [];

        content.forEach((part) => {
            if (!part || typeof part !== 'object') {
                const text = String(part ?? '').trim();
                if (text) {
                    normalizedParts.push({ type: 'input_text', text });
                }
                return;
            }

            const typedPart = part as Record<string, any>;
            const partType = String(typedPart.type || '').trim().toLowerCase();

            if (partType === 'input_text' || partType === 'text') {
                const text = String(typedPart.text ?? typedPart.content ?? '').trim();
                if (text) {
                    normalizedParts.push({ type: 'input_text', text });
                }
                return;
            }

            if (partType === 'input_image') {
                const imageUrl = String(typedPart.image_url || typedPart.url || '').trim();
                if (imageUrl) {
                    normalizedParts.push({ type: 'input_image', image_url: imageUrl });
                }
                return;
            }

            if (partType === 'image_url') {
                const rawImageUrl = typedPart.image_url;
                const imageUrl = typeof rawImageUrl === 'string'
                    ? rawImageUrl.trim()
                    : String(rawImageUrl?.url || '').trim();
                if (imageUrl) {
                    normalizedParts.push({ type: 'input_image', image_url: imageUrl });
                }
                return;
            }

            const fallbackText = String(typedPart.text ?? '').trim();
            if (fallbackText) {
                normalizedParts.push({ type: 'input_text', text: fallbackText });
            }
        });

        return normalizedParts;
    }

    const text = String(content ?? '').trim();
    return text ? [{ type: 'input_text', text }] : [];
}

function extractTextFromContent(parts: string[], content: unknown): void {
    if (typeof content === 'string') {
        pushText(parts, content);
        return;
    }

    if (Array.isArray(content)) {
        content.forEach((item) => extractTextFromContent(parts, item));
        return;
    }

    if (!content || typeof content !== 'object') {
        return;
    }

    const typedContent = content as Record<string, any>;
    pushText(parts, typedContent.text);
    pushText(parts, typedContent.output_text);
    pushText(parts, typedContent.value);

    if ('content' in typedContent) {
        extractTextFromContent(parts, typedContent.content);
    }
}

export function modelPrefersResponsesApi(modelId?: string): boolean {
    const normalized = normalizeModelId(modelId);
    return RESPONSE_ONLY_MODEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function shouldRetryWithResponsesApi(status: number | undefined, errorText: string | undefined): boolean {
    if (!errorText) return false;

    const text = String(errorText || '').toLowerCase();
    if (!text) return false;

    if (text.includes('/v1/responses') || text.includes('use /v1/responses')) {
        return true;
    }

    if ((text.includes('responses api') || text.includes('response api')) && !text.includes('image')) {
        return true;
    }

    if (
        (text.includes('chat/completions') || text.includes('/chat/completions'))
        && (text.includes('not supported') || text.includes('unsupported') || text.includes('invalid'))
    ) {
        return true;
    }

    if (
        status === 400
        && text.includes('responses')
        && (text.includes('model') || text.includes('endpoint'))
    ) {
        return true;
    }

    return false;
}

export function buildResponsesPayload(params: {
    model: string;
    messages: OpenAICompatibleMessage[];
    systemPrompt?: string;
    inlineData?: InlineDataPart[];
    temperature?: number;
    maxOutputTokens?: number;
    stream?: boolean;
    extraBody?: Record<string, any>;
}): Record<string, any> {
    const messages = params.messages.map((message) => ({
        role: String(message.role || 'user'),
        content: message.content,
    }));

    if (params.inlineData?.length) {
        const lastUserIndex = messages.map((message) => message.role).lastIndexOf('user');
        if (lastUserIndex >= 0) {
            const baseContent = normalizeResponsesContent(messages[lastUserIndex].content);
            params.inlineData.forEach((media) => {
                baseContent.push({
                    type: 'input_image',
                    image_url: `data:${media.mimeType};base64,${media.data}`,
                });
            });
            messages[lastUserIndex].content = baseContent;
        }
    }

    if (params.systemPrompt) {
        messages.unshift({
            role: 'system',
            content: params.systemPrompt,
        });
    }

    const body: Record<string, any> = {
        model: params.model,
        input: messages.map((message) => ({
            role: message.role,
            content: normalizeResponsesContent(message.content),
        })),
        stream: Boolean(params.stream),
    };

    if (typeof params.temperature === 'number') {
        body.temperature = params.temperature;
    }

    if (typeof params.maxOutputTokens === 'number' && Number.isFinite(params.maxOutputTokens) && params.maxOutputTokens > 0) {
        body.max_output_tokens = Math.round(params.maxOutputTokens);
    }

    if (params.extraBody && typeof params.extraBody === 'object') {
        Object.assign(body, params.extraBody);
    }

    return body;
}

export function extractTextFromResponsesPayload(payload: any): string {
    const parts: string[] = [];

    pushText(parts, payload?.output_text);

    if (Array.isArray(payload?.output)) {
        payload.output.forEach((item: any) => extractTextFromContent(parts, item?.content ?? item));
    }

    extractTextFromContent(parts, payload?.content);
    extractTextFromContent(parts, payload?.response?.output);

    return parts.join('\n').trim();
}

export function extractOpenAITextPayload(payload: any): string {
    const directContent = payload?.choices?.[0]?.message?.content;
    if (typeof directContent === 'string' && directContent.trim()) {
        return directContent;
    }

    if (Array.isArray(directContent)) {
        const parts: string[] = [];
        directContent.forEach((item: any) => extractTextFromContent(parts, item));
        const combined = parts.join('\n').trim();
        if (combined) return combined;
    }

    return extractTextFromResponsesPayload(payload);
}

export function extractOpenAIUsage(payload: any): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
} {
    const promptTokens = Number(payload?.usage?.prompt_tokens ?? payload?.usage?.input_tokens ?? 0) || 0;
    const completionTokens = Number(payload?.usage?.completion_tokens ?? payload?.usage?.output_tokens ?? 0) || 0;
    const totalTokens = Number(payload?.usage?.total_tokens ?? (promptTokens + completionTokens)) || 0;

    return {
        promptTokens,
        completionTokens,
        totalTokens,
    };
}

export function extractResponsesStreamDelta(payload: any): string {
    if (!payload || typeof payload !== 'object') {
        return '';
    }

    if (payload.type === 'response.output_text.delta') {
        return String(payload.delta || '');
    }

    if (typeof payload.delta === 'string') {
        return payload.delta;
    }

    if (typeof payload.delta?.text === 'string') {
        return payload.delta.text;
    }

    return '';
}

export function isResponsesPayload(payload: any): boolean {
    return typeof payload?.output_text === 'string' || Array.isArray(payload?.output);
}
