import { LLMAdapter, ChatOptions, ImageGenerationOptions, ImageGenerationResult, extractRefImageData, AudioGenerationOptions, AudioGenerationResult } from './LLMAdapter';
import { GenerationMode } from '../../types';
import { KeySlot } from '../auth/keyManager';
import { GOOGLE_API_BASE } from '../api/apiConfig';
import { logError } from '../system/systemLogService';
import { assertNoDirectCall } from '../../utils/security';
import { forwardUserRouteGenericRequest } from '../model/secureModelProxy';
import { AsyncTaskPoller, PollCancelledError } from '../http/AsyncTaskPoller';
import { kernelFetch } from '../http/requestKernel';

export async function convertImageToBase64(imageData: string): Promise<string | null> {
    // If it's already a pure base64 string (no prefix), return as-is
    if (!imageData.includes(':') && !imageData.includes('/')) {
        return imageData;
    }

    // If it's a data URL (data:image/png;base64,...), extract base64 part
    if (imageData.startsWith('data:')) {
        const base64Match = imageData.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
            return base64Match[1];
        }
        // If data URL but not base64, try to fetch and convert
        try {
            const response = await kernelFetch(imageData);
            const blob = await response.blob();
            return await blobToBase64(blob);
        } catch (e) {
            console.error('[GoogleAdapter] Failed to convert data URL to base64:', e);
            return null;
        }
    }

    // If it's a blob URL (blob:http://...), fetch and convert
    if (imageData.startsWith('blob:')) {
        try {
            const response = await kernelFetch(imageData);
            const blob = await response.blob();
            return await blobToBase64(blob);
        } catch (e) {
            console.error('[GoogleAdapter] Failed to convert blob URL to base64:', e);
            return null;
        }
    }

    // Unknown format, return as-is and hope for the best
    return imageData;
}

/**
 * Helper: Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Extract base64 part from data URL
            const base64Match = result.match(/^data:[^;]+;base64,(.+)$/);
            if (base64Match) {
                resolve(base64Match[1]);
            } else {
                reject(new Error('Failed to convert blob to base64'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function is12AIGateway(baseUrl: string): boolean {
    try {
        const host = new URL(baseUrl).hostname;
        return /(^|\.)12ai\.org$/i.test(host);
    } catch {
        return false;
    }
}

function normalizeGeminiImageSize(raw: string | undefined): '512px' | '1K' | '2K' | '4K' {
    const v = (raw || '').trim().toUpperCase();
    if (v.includes('512') || v.includes('0.5K')) return '512px';
    if (v.includes('4K') || v.includes('HD')) return '4K';
    if (v.includes('2K')) return '2K';
    return '1K';
}

function extractUsageMetadata(data: any) {
    const usage = data?.usageMetadata || data?.usage_metadata;
    if (!usage || typeof usage !== 'object') {
        return undefined;
    }

    const promptTokens = Number(usage.promptTokenCount ?? usage.prompt_token_count);
    const rawCompletionTokens = Number(usage.candidatesTokenCount ?? usage.candidates_token_count);
    const totalTokens = Number(usage.totalTokenCount ?? usage.total_token_count);
    const completionTokens = Number.isFinite(rawCompletionTokens)
        ? rawCompletionTokens
        : (Number.isFinite(totalTokens) && Number.isFinite(promptTokens))
            ? Math.max(0, totalTokens - promptTokens)
            : Number.NaN;

    if (![promptTokens, completionTokens, totalTokens].some((value) => Number.isFinite(value) && value > 0)) {
        return undefined;
    }

    return {
        promptTokens: Number.isFinite(promptTokens) ? promptTokens : undefined,
        completionTokens: Number.isFinite(completionTokens) ? completionTokens : undefined,
        totalTokens: Number.isFinite(totalTokens) ? totalTokens : undefined,
    };
}

export function buildInlineImagePart(base64Data: string, mimeType: string, useSnakeCase: boolean = false): any {
    if (useSnakeCase) {
        return {
            inline_data: {
                mime_type: mimeType,
                data: base64Data
            }
        };
    }
    return {
        inlineData: {
            mimeType,
            data: base64Data
        }
    };
}

function normalizeToolsForGateway(tools: any[] | undefined, useSnakeCase: boolean): any[] | undefined {
    return buildGeminiNativeGroundingTools(tools, useSnakeCase);
}

export function extractGoogleSearchToolIntent(tools: any[] | undefined): {
    enabled: boolean;
    wantsImageSearch: boolean;
    wantsWebSearch: boolean;
} {
    if (!tools || tools.length === 0) {
        return {
            enabled: false,
            wantsImageSearch: false,
            wantsWebSearch: false,
        };
    }

    for (const tool of tools) {
        const googleSearch = tool?.googleSearch || tool?.google_search;
        if (!googleSearch) continue;

        const searchTypes = googleSearch?.searchTypes || googleSearch?.search_types;
        const wantsImageSearch = Boolean(searchTypes?.imageSearch || searchTypes?.image_search);
        const wantsWebSearch = !searchTypes || Boolean(searchTypes?.webSearch || searchTypes?.web_search);

        return {
            enabled: true,
            wantsImageSearch,
            wantsWebSearch,
        };
    }

    return {
        enabled: false,
        wantsImageSearch: false,
        wantsWebSearch: false,
    };
}

export function buildGeminiNativeGroundingTools(
    tools: any[] | undefined,
    useSnakeCase: boolean = false
): any[] | undefined {
    if (!tools || tools.length === 0) return tools;

    const intent = extractGoogleSearchToolIntent(tools);
    if (!intent.enabled) return tools;

    const passthroughTools = tools.filter((tool) => !tool?.googleSearch && !tool?.google_search);
    const toolKey = useSnakeCase ? 'google_search' : 'googleSearch';

    // Gemini native image grounding is stable with a plain Google Search tool.
    // The older structured searchTypes payload can trigger INVALID_ARGUMENT on current routes.
    return [
        ...passthroughTools,
        { [toolKey]: {} },
    ];
}

function buildSafeRequestBodyPreview(payload: any): string {
    const redact = (node: any): any => {
        if (Array.isArray(node)) return node.map(redact);
        if (node && typeof node === 'object') {
            const out: Record<string, any> = {};
            Object.entries(node).forEach(([k, v]) => {
                const lower = k.toLowerCase();
                if (['authorization', 'api_key', 'apikey', 'token', 'secret', 'key'].includes(lower)) {
                    out[k] = '<omitted:sensitive>';
                    return;
                }
                out[k] = redact(v);
            });
            return out;
        }
        if (typeof node === 'string') {
            if (node.startsWith('data:')) return '<omitted:data-uri>';
            if (/^https?:\/\//i.test(node) && node.length > 120) return '<omitted:url>';
            if (/^[A-Za-z0-9+/=]+$/.test(node) && node.length > 200) return '<omitted:base64>';
            if (node.length > 400) return `${node.slice(0, 200)}...<truncated>`;
            return node;
        }
        return node;
    };

    try {
        return JSON.stringify(redact(payload), null, 2);
    } catch {
        return '{\n  "error": "preview_unavailable"\n}';
    }
}

function extractGroundingInfo(data: any, candidate: any): {
    searchEntryPoint?: string;
    sources?: Array<{ uri: string; title?: string; imageUri?: string }>;
} {
    const rootMeta = data?.groundingMetadata || data?.grounding_metadata;
    const candidateMeta = candidate?.groundingMetadata || candidate?.grounding_metadata;
    const meta = candidateMeta || rootMeta;
    if (!meta) return {};

    const searchEntryPoint =
        meta?.searchEntryPoint?.renderedContent ||
        meta?.search_entry_point?.rendered_content ||
        '';

    const chunks = meta?.groundingChunks || meta?.grounding_chunks || [];
    const seen = new Set<string>();
    const sources: Array<{ uri: string; title?: string; imageUri?: string }> = [];
    for (const chunk of chunks) {
        const web = chunk?.web || chunk?.webChunk || chunk?.web_chunk;
        const uri = web?.uri || web?.url || '';
        if (!uri || seen.has(uri)) continue;
        seen.add(uri);
        sources.push({
            uri,
            title: web?.title,
            imageUri: web?.imageUri || web?.image_uri
        });
    }

    return {
        searchEntryPoint: searchEntryPoint || undefined,
        sources: sources.length > 0 ? sources : undefined
    };
}

/**
 * Google Adapter - Official Google API Protocol Only
 *
 * Handles:
 * - Gemini (Chat & Image via :generateContent)
 * - Imagen (Image via :predict)
 * - Veo (Video via :predictLongRunning)
 *
 * STRICTLY ignores OpenAI/Antigravity protocols.
 */
export class GoogleAdapter implements LLMAdapter {
    id = 'google-adapter';
    provider = 'Google';

    supports(modelId: string): boolean {
        const id = modelId.toLowerCase();
        return id.startsWith('gemini-') || id.startsWith('imagen-') || id.startsWith('veo-') || id.startsWith('lyria-');
    }

    async chat(options: ChatOptions, keySlot: KeySlot): Promise<string> {
        const baseUrl = keySlot.baseUrl || GOOGLE_API_BASE;
        const cleanBase = baseUrl.replace(/\/+$/, '');
        const useSnakeCase = false;
        
        // 步骤 A: 移除 URL 中的 ?key=${keySlot.key}
        const url = `${cleanBase}/v1beta/models/${options.modelId}:generateContent`;

        // 步骤 C: 安全守卫
        assertNoDirectCall(url);

        const contents = options.messages.map((msg, idx) => {
            const parts: any[] = [{ text: msg.content }];

            // Handle Multimodal Input (Inline Data)
            const isLastUserMessage = msg.role === 'user' && idx === options.messages.length - 1;
            if (isLastUserMessage && options.inlineData && options.inlineData.length > 0) {
                options.inlineData.forEach(media => {
                    parts.push(buildInlineImagePart(media.data, media.mimeType, useSnakeCase));
                });
            }

            return {
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts
            };
        });

        let maxTokens = options.maxTokens || 20480;
        if (maxTokens > 65535) {
            console.warn(`[GoogleAdapter] maxOutputTokens (${maxTokens}) 超过 Google 限制，自动钳位至 65535`);
            maxTokens = 65535;
        }

        const generationConfig: any = {
            temperature: options.temperature,
            maxOutputTokens: maxTokens
        };

        if (options.providerConfig?.google) {
            if (options.providerConfig.google.responseModalities) {
                generationConfig.responseModalities = options.providerConfig.google.responseModalities;
            }
        }

        const payload: any = {
            contents,
            generationConfig
        };

        const payloadStr = JSON.stringify(payload);
        if (payloadStr.length > 45 * 1024 * 1024) {
            console.error(`[GoogleAdapter] 请求体积 (${(payloadStr.length / 1024 / 1024).toFixed(2)}MB) 接近 50MB 上限，可能导致 413 错误`);
        }

        if (options.providerConfig?.google?.safetySettings) {
            payload.safetySettings = options.providerConfig.google.safetySettings;
        }
        if (options.providerConfig?.google?.tools) {
            payload.tools = normalizeToolsForGateway(options.providerConfig.google.tools, useSnakeCase);
        }

        // 步骤 B: 替换裸 fetch 为代理转发
        const response = await forwardUserRouteGenericRequest({
            provider: 'google',
            keyId: keySlot.id,
            url,
            method: 'POST',
            rawBody: payload,
            headers: { 'Content-Type': 'application/json' },
            signal: options.signal
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const errMsg = err.error?.message || `Google API Error: ${response.statusText}`;
            logError('GoogleAdapter', new Error(errMsg), `URL: ${url}\nStatus: ${response.status}\nResponse: ${JSON.stringify(err)}`);
            throw new Error(errMsg);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    async generateImage(options: ImageGenerationOptions, keySlot: KeySlot): Promise<ImageGenerationResult> {
        const modelId = options.modelId.toLowerCase();

        if (modelId.startsWith('veo-')) {
            return this.generateVeoVideo(options, keySlot);
        }

        if (modelId.startsWith('imagen-')) {
            return this.generateImagenImage(options, keySlot);
        }

        return this.generateGeminiImage(options, keySlot);
    }

    /**
     * Gemini Image Generation (Multimodal)
     */
    private async generateGeminiImage(options: ImageGenerationOptions, keySlot: KeySlot): Promise<ImageGenerationResult> {
        const cleanBase = (keySlot.baseUrl || GOOGLE_API_BASE).replace(/\/+$/, '');
        const is12AI = is12AIGateway(cleanBase);
        const useSnakeCase = false;

        const realModelId = (options.modelId || '').split('@')[0];
        
        // 步骤 A: 移除 URL 中的 ?key=${keySlot.key}
        const url = `${cleanBase}/v1beta/models/${realModelId}:generateContent`;

        // 步骤 C: 安全守卫
        assertNoDirectCall(url);

        const parts: any[] = [];

        if (options.referenceImages?.length) {
            const convertedImages = await Promise.all(
                options.referenceImages.map(async (refImg) => {
                    const { data: imgData, mimeType } = extractRefImageData(refImg);
                    const base64 = await convertImageToBase64(imgData);
                    return base64 ? { mimeType, data: base64 } : null;
                })
            );

            convertedImages.forEach(inlineData => {
                if (inlineData) {
                    parts.push(buildInlineImagePart(inlineData.data, inlineData.mimeType, useSnakeCase));
                }
            });
        }

        parts.push({ text: options.prompt });

        const generationConfig: any = {
            responseModalities: options.providerConfig?.google?.responseModalities || ["TEXT", "IMAGE"]
        };
        const thinkingLevel = options.providerConfig?.google?.thinkingConfig?.thinkingLevel;
        if (thinkingLevel === 'minimal' || thinkingLevel === 'high') {
            generationConfig.thinkingConfig = { thinkingLevel };
        }
        if (!is12AI) {
            generationConfig.temperature = 0.9;
        }

        if (options.editMode === 'inpaint' && options.maskUrl) {
            const maskBase64 = await convertImageToBase64(options.maskUrl);
            if (maskBase64) {
                console.log('[GoogleAdapter] Adding mask to Gemini inpaint request');
                parts.push(buildInlineImagePart(maskBase64, 'image/png', useSnakeCase));
            }
        }

        const imageConfig: any = {};

        if (options.aspectRatio && String(options.aspectRatio).toLowerCase() !== 'auto') {
            imageConfig.aspectRatio = options.aspectRatio;
        }

        const requestedSize = normalizeGeminiImageSize(
            options.providerConfig?.google?.imageConfig?.imageSize || options.imageSize
        );
        let lastRequestPayload = '';
        let lastApiDurationMs = 0;
        let lastRequestPayloadObj: any = {};

        const requestGemini = async (withImageSize: boolean) => {
            const effectiveImageConfig: any = { ...imageConfig };
            if (withImageSize) {
                effectiveImageConfig.imageSize = requestedSize;
            }

            const payload: any = {
                contents: [{ parts }],
                generationConfig: {
                    ...generationConfig,
                    imageConfig: effectiveImageConfig
                }
            };
            lastRequestPayload = JSON.stringify(payload);
            lastRequestPayloadObj = payload;

            if (options.providerConfig?.google?.tools) {
                payload.tools = normalizeToolsForGateway(options.providerConfig.google.tools, useSnakeCase);
            }

            const startAt = Date.now();
            
            // 步骤 B: 替换裸 fetch 为代理转发
            const response = await forwardUserRouteGenericRequest({
                provider: 'google',
                keyId: keySlot.id,
                url,
                method: 'POST',
                rawBody: payload,
                headers: { 'Content-Type': 'application/json' }
            });
            
            lastApiDurationMs = Date.now() - startAt;

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                const msg = err?.error?.message || `Gemini Image Error: ${response.status}`;
                logError('GoogleAdapter', new Error(msg), `URL: ${url}\nStatus: ${response.status}\nResponse: ${JSON.stringify(err)}`);
                throw new Error(msg);
            }

            const data = await response.json();
            return { data, effectiveImageConfig };
        };

        let data: any;
        let effectiveImageConfig: any = imageConfig;
        const wantsLargeSize = !!options.imageSize && requestedSize !== '1K';

        try {
            const first = await requestGemini(wantsLargeSize || !!options.imageSize);
            data = first.data;
            effectiveImageConfig = first.effectiveImageConfig;
        } catch (e: any) {
            const msg = String(e?.message || '').toLowerCase();
            const likelySizeNotSupported = msg.includes('invalid_argument') || msg.includes('imagesize') || msg.includes('image_size');

            if (wantsLargeSize && likelySizeNotSupported) {
                console.warn('[GoogleAdapter] imageSize not supported by current endpoint, retrying without imageSize');
                const fallback = await requestGemini(false);
                data = fallback.data;
                effectiveImageConfig = fallback.effectiveImageConfig;
            } else {
                throw e;
            }
        }

        const candidate = data.candidates?.[0];
        const usage = extractUsageMetadata(data);
        if (!candidate) {
            throw new Error(`Google API returned no candidates. Finish Reason: ${data.candidates?.[0]?.finishReason || 'Unknown'}`);
        }

        const candidateParts = candidate.content?.parts || [];
        const imageParts = candidateParts.filter((p: any) => {
            const inlineData = p?.inlineData || p?.inline_data;
            const mimeType = inlineData?.mimeType || inlineData?.mime_type || '';
            return typeof mimeType === 'string' && mimeType.startsWith('image/');
        });

        if (imageParts.length > 0) {
            let bestImage = imageParts[0];
            let maxDataLength = 0;

            if (imageParts.length > 1) {
                console.log(`[GoogleAdapter] Detected ${imageParts.length} images in response, selecting largest...`);
                for (const part of imageParts) {
                    const inlineData = part?.inlineData || part?.inline_data;
                    const dataLength = inlineData?.data?.length || 0;
                    if (dataLength > maxDataLength) {
                        maxDataLength = dataLength;
                        bestImage = part;
                    }
                }
                console.log(`[GoogleAdapter] Selected image with data length: ${maxDataLength} (${(maxDataLength * 0.75 / 1024 / 1024).toFixed(2)}MB estimated)`);
            }

            const bestInlineData = bestImage?.inlineData || bestImage?.inline_data;
            const bestMime = bestInlineData?.mimeType || bestInlineData?.mime_type || 'image/png';
            const bestData = String(bestInlineData?.data || '').replace(/\s+/g, '');
            if (!bestData) {
                throw new Error('Gemini returned image part but base64 data is empty');
            }
            const grounding = extractGroundingInfo(data, candidate);

            return {
                urls: [`data:${bestMime};base64,${bestData}`],
                usage,
                provider: 'Google',
                model: options.modelId,
                imageSize: effectiveImageConfig.imageSize || '1K',
                metadata: {
                    aspectRatio: effectiveImageConfig.aspectRatio || effectiveImageConfig.aspect_ratio,
                    apiDurationMs: lastApiDurationMs,
                    grounding,
                    requestPath: (() => {
                        try {
                            return new URL(url).pathname;
                        } catch {
                            return url;
                        }
                    })(),
                    requestBodyPreview: buildSafeRequestBodyPreview(lastRequestPayloadObj),
                    pythonSnippet: (() => {
                        return `import requests\n\nurl = "${url}?key=<API_KEY>"\npayload = ${lastRequestPayload || '{}'}\nresp = requests.post(url, json=payload, timeout=150)\nprint(resp.status_code)\nprint(resp.text[:1000])`;
                    })()
                }
            };
        }

        const fileUri = candidateParts
            .map((p: any) => p?.fileData?.fileUri || p?.file_data?.file_uri || p?.fileData?.uri || p?.file_data?.uri)
            .find((u: any) => typeof u === 'string' && /^https?:\/\//i.test(u));
        if (fileUri) {
            return {
                urls: [fileUri],
                usage,
                provider: 'Google',
                model: options.modelId,
                imageSize: effectiveImageConfig.imageSize || '1K',
                metadata: {
                    aspectRatio: effectiveImageConfig.aspectRatio || effectiveImageConfig.aspect_ratio,
                    apiDurationMs: lastApiDurationMs,
                    requestPath: (() => {
                        try { return new URL(url).pathname; } catch { return url; }
                    })(),
                    requestBodyPreview: buildSafeRequestBodyPreview(lastRequestPayloadObj)
                }
            };
        }

        const proxyData = data?.data?.[0];
        if (proxyData?.b64_json) {
            const b64 = String(proxyData.b64_json).replace(/\s+/g, '');
            return {
                urls: [`data:image/png;base64,${b64}`],
                usage,
                provider: 'Google',
                model: options.modelId,
                imageSize: effectiveImageConfig.imageSize || '1K',
                metadata: {
                    aspectRatio: effectiveImageConfig.aspectRatio || effectiveImageConfig.aspect_ratio,
                    apiDurationMs: lastApiDurationMs,
                    requestPath: (() => {
                        try { return new URL(url).pathname; } catch { return url; }
                    })(),
                    requestBodyPreview: buildSafeRequestBodyPreview(lastRequestPayloadObj)
                }
            };
        }
        if (typeof proxyData?.url === 'string' && /^https?:\/\//i.test(proxyData.url)) {
            return {
                urls: [proxyData.url],
                usage,
                provider: 'Google',
                model: options.modelId,
                imageSize: effectiveImageConfig.imageSize || '1K',
                metadata: {
                    aspectRatio: effectiveImageConfig.aspectRatio || effectiveImageConfig.aspect_ratio,
                    apiDurationMs: lastApiDurationMs,
                    requestPath: (() => {
                        try { return new URL(url).pathname; } catch { return url; }
                    })(),
                    requestBodyPreview: buildSafeRequestBodyPreview(lastRequestPayloadObj)
                }
            };
        }

        const textPart = candidateParts.find((p: any) => p.text);
        if (textPart?.text) {
            throw new Error(`Gemini Image Generation Fail: ${textPart.text}`);
        }

        throw new Error("No image data in multimodal response");
    }

    /**
     * Imagen Image Generation (:predict)
     */
    private async generateImagenImage(options: ImageGenerationOptions, keySlot: KeySlot): Promise<ImageGenerationResult> {
        const cleanBase = (keySlot.baseUrl || GOOGLE_API_BASE).replace(/\/+$/, '');
        
        // 步骤 A: 移除 URL 中的 ?key=${keySlot.key}
        const url = `${cleanBase}/v1beta/models/${options.modelId}:predict`;

        // 步骤 C: 安全守卫
        assertNoDirectCall(url);

        const parameters: any = {
            sampleCount: options.imageCount || 1,
        };

        if (options.aspectRatio && String(options.aspectRatio).toLowerCase() !== 'auto') {
            parameters.aspectRatio = options.aspectRatio;
        }

        if (options.imageSize) {
            const size = options.imageSize.toUpperCase();
            if (size.includes('2K') || size.includes('4K') || size.includes('HD')) parameters.sampleImageSize = '2K';
            else parameters.sampleImageSize = '1K';
        }

        if (options.providerConfig?.imagen?.personGeneration) {
            parameters.personGeneration = options.providerConfig.imagen.personGeneration;
        }

        const instances: any[] = [];

        if (options.editMode === 'inpaint' && options.maskUrl && options.referenceImages?.length) {
            const { data: refData } = extractRefImageData(options.referenceImages[0]);
            const originalBase64 = await convertImageToBase64(refData);
            const maskBase64 = await convertImageToBase64(options.maskUrl);

            if (originalBase64 && maskBase64) {
                instances.push({
                    prompt: options.prompt,
                    image: { bytesBase64Encoded: originalBase64 }
                });

                parameters.editConfig = {
                    editMode: "INPAINT_INSERTION",
                    mask: {
                        image: { bytesBase64Encoded: maskBase64 }
                    }
                };
            } else {
                instances.push({ prompt: options.prompt });
            }
        } else {
            instances.push({ prompt: options.prompt });
        }

        const payload = {
            instances,
            parameters
        };

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        // 步骤 B: 替换裸 fetch 为代理转发 (使用 rawBody 透传模式)
        const response = await forwardUserRouteGenericRequest({
            provider: 'google',
            keyId: keySlot.id,
            url,
            method: 'POST',
            rawBody: payload,
            headers
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `Imagen Error: ${response.status}`);
        }

        const data = await response.json();
        const predictions = data.predictions || [];
        let bestPrediction = predictions[0];
        if (predictions.length > 1) {
            let maxLen = 0;
            for (const p of predictions) {
                const len = p?.bytesBase64Encoded?.length || 0;
                if (len > maxLen) {
                    maxLen = len;
                    bestPrediction = p;
                }
            }
            console.log(`[GoogleAdapter] Selected best Imagen prediction from ${predictions.length} options (Length: ${maxLen})`);
        }

        const b64 = bestPrediction?.bytesBase64Encoded;

        if (b64) {
            const result: ImageGenerationResult = {
                urls: [`data:image/png;base64,${b64}`],
                provider: 'Google',
                model: options.modelId,
                metadata: {
                    requestPath: (() => {
                        try { return new URL(url).pathname; } catch { return url; }
                    })(),
                    requestBodyPreview: buildSafeRequestBodyPreview(payload),
                    pythonSnippet: `import requests\n\nurl = "${url}?key=<API_KEY>"\npayload = ${JSON.stringify(payload)}\nresp = requests.post(url, json=payload, timeout=150)\nprint(resp.status_code)\nprint(resp.text[:1000])`
                }
            };
            return result;
        }

        throw new Error("No image data in Imagen response");
    }

    /**
     * Veo 视频生成 - 异步轮询实现
     */
    private async generateVeoVideo(options: ImageGenerationOptions, keySlot: KeySlot): Promise<ImageGenerationResult> {
        const cleanBase = (keySlot.baseUrl || GOOGLE_API_BASE).replace(/\/+$/, '');
        const model = options.modelId || 'veo-3.1-generate-preview';
        
        // 步骤 A: 移除 URL 中的 ?key= 拼接
        const submitUrl = `${cleanBase}/v1beta/models/${model}:predictLongRunning`;

        // 步骤 C: 安全守卫
        assertNoDirectCall(submitUrl);

        const payload: any = {
            instances: [{ prompt: options.prompt }]
        };
        if (options.aspectRatio && options.aspectRatio !== 'auto') {
            payload.parameters = {
                aspectRatio: options.aspectRatio
            };
        }

        // 步骤 B: 使用 forwardUserRouteGenericRequest 代理提交
        const response = await forwardUserRouteGenericRequest({
            provider: 'google',
            keyId: keySlot.id,
            url: submitUrl,
            method: 'POST',
            rawBody: payload,
            headers: { 'Content-Type': 'application/json' },
            signal: options.signal
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Veo submit failed (${response.status}): ${errText.slice(0, 300)}`);
        }

        const initData = await response.json();
        const operationId = initData.name;
        if (!operationId) {
            throw new Error('No operation name returned from Veo API');
        }

        if (options.onTaskId) {
            options.onTaskId(operationId);
        }

        // 轮询 URL，同样使用代理获取状态，不需要 query params 携带 key
        const pollUrl = `${cleanBase}/v1beta/${operationId}`;
        
        const poller = new AsyncTaskPoller<any, any>({
            submitFn: async () => ({ operationId }),
            pollFn: async (id, sig) => {
                const pollResponse = await forwardUserRouteGenericRequest({
                    provider: 'google',
                    keyId: keySlot.id,
                    url: pollUrl,
                    method: 'GET',
                    signal: sig
                });
                if (!pollResponse.ok) {
                    throw new Error(`Veo poll failed (${pollResponse.status})`);
                }
                return await pollResponse.json().catch(() => ({}));
            },
            extractId: (submit) => submit.operationId,
            isDone: (result) => !!result.done,
            isFailed: (result) => !!result.error,
            interval: 10000,
            maxWait: 30 * 60 * 1000, // 30 分钟
        });

        let onAbort: (() => void) | undefined;
        if (options.signal) {
            if (options.signal.aborted) {
                poller.cancel();
                throw new PollCancelledError();
            }
            onAbort = () => poller.cancel();
            options.signal.addEventListener('abort', onAbort);
        }

        try {
            const pollResult = await poller.start();
            if (pollResult.error) {
                throw new Error(pollResult.error.message || 'Veo video generation failed');
            }

            const videoUri = pollResult.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
            if (!videoUri) {
                throw new Error('No video URI in Veo response');
            }

            // 代理下载视频流
            const downloadResponse = await forwardUserRouteGenericRequest({
                provider: 'google',
                keyId: keySlot.id,
                url: videoUri,
                method: 'GET',
                headers: { 'Accept': 'video/mp4,video/*,*/*' },
                signal: options.signal
            });

            if (!downloadResponse.ok) {
                throw new Error(`Veo video download failed via proxy: HTTP ${downloadResponse.status}`);
            }

            const blob = await downloadResponse.blob();
            const reader = new FileReader();
            const videoDataUrl = await new Promise<string>((res, rej) => {
                reader.onloadend = () => res(reader.result as string);
                reader.onerror = rej;
                reader.readAsDataURL(blob);
            });

            return {
                urls: [videoDataUrl],
                provider: 'Google',
                model: options.modelId
            };

        } catch (err: any) {
            if (err instanceof PollCancelledError) {
                throw err;
            }
            throw new Error(err.message || 'Veo video generation failed');
        } finally {
            if (options.signal && onAbort) {
                options.signal.removeEventListener('abort', onAbort);
            }
        }
    }

    /**
     * Veo 视频生成 - 异步轮询实现
     */
    async generateVideo(options: import('./LLMAdapter').VideoGenerationOptions, keySlot: KeySlot): Promise<import('./LLMAdapter').VideoGenerationResult> {
        const cleanBase = (keySlot.baseUrl || GOOGLE_API_BASE).replace(/\/+$/, '');
        const model = options.modelId || 'veo-3.1-generate-preview';
        
        // 步骤 A: 移除 URL 中的 ?key= 拼接
        const submitUrl = `${cleanBase}/v1beta/models/${model}:predictLongRunning`;

        // 步骤 C: 安全守卫
        assertNoDirectCall(submitUrl);

        const images: string[] = [];
        if (options.imageUrl) images.push(options.imageUrl.replace(/^data:image\/[^;]+;base64,/, ''));
        if (options.imageTailUrl) images.push(options.imageTailUrl.replace(/^data:image\/[^;]+;base64,/, ''));

        const instance: any = {
            prompt: options.prompt
        };
        if (images.length === 1) {
            instance.image = { bytesBase64Encoded: images[0] };
        } else if (images.length === 2) {
            instance.image = { bytesBase64Encoded: images[0] };
            instance.lastFrame = { bytesBase64Encoded: images[1] };
        }

        const payload: any = {
            instances: [instance]
        };
        const parameters: any = {};
        if (options.aspectRatio && String(options.aspectRatio).toLowerCase() !== 'auto') {
            parameters.aspectRatio = options.aspectRatio;
        }
        if (options.resolution) {
            parameters.resolution = options.resolution;
        }
        if (Object.keys(parameters).length > 0) {
            payload.parameters = parameters;
        }

        // 步骤 B: 使用 forwardUserRouteGenericRequest 代理提交
        const response = await forwardUserRouteGenericRequest({
            provider: 'google',
            keyId: keySlot.id,
            url: submitUrl,
            method: 'POST',
            rawBody: payload,
            headers: { 'Content-Type': 'application/json' },
            signal: options.signal
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Video generation submit failed (${response.status}): ${errText.slice(0, 300)}`);
        }

        const initData = await response.json();
        const operationId = initData.name;
        if (!operationId) {
            throw new Error('No operation name returned from Veo Video API');
        }

        if (options.onTaskId) {
            options.onTaskId(operationId);
        }

        // 轮询
        const pollUrl = `${cleanBase}/v1beta/${operationId}`;
        
        const poller = new AsyncTaskPoller<any, any>({
            submitFn: async () => ({ operationId }),
            pollFn: async (id, sig) => {
                const pollResponse = await forwardUserRouteGenericRequest({
                    provider: 'google',
                    keyId: keySlot.id,
                    url: pollUrl,
                    method: 'GET',
                    signal: sig
                });
                if (!pollResponse.ok) {
                    throw new Error(`Video poll failed (${pollResponse.status})`);
                }
                return await pollResponse.json().catch(() => ({}));
            },
            extractId: (submit) => submit.operationId,
            isDone: (result) => !!result.done,
            isFailed: (result) => !!result.error,
            interval: 10000,
            maxWait: 30 * 60 * 1000, // 30 分钟
        });

        let onAbort: (() => void) | undefined;
        if (options.signal) {
            if (options.signal.aborted) {
                poller.cancel();
                throw new PollCancelledError();
            }
            onAbort = () => poller.cancel();
            options.signal.addEventListener('abort', onAbort);
        }

        try {
            const pollResult = await poller.start();
            if (pollResult.error) {
                throw new Error(pollResult.error.message || 'Video generation failed');
            }

            const videoUri = pollResult.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
            if (!videoUri) {
                throw new Error('No video URI in Veo Video response');
            }

            // 代理下载视频
            const downloadResponse = await forwardUserRouteGenericRequest({
                provider: 'google',
                keyId: keySlot.id,
                url: videoUri,
                method: 'GET',
                headers: { 'Accept': 'video/mp4,video/*,*/*' },
                signal: options.signal
            });

            if (!downloadResponse.ok) {
                throw new Error(`Video download failed via proxy: HTTP ${downloadResponse.status}`);
            }

            const blob = await downloadResponse.blob();
            const reader = new FileReader();
            const videoDataUrl = await new Promise<string>((res, rej) => {
                reader.onloadend = () => res(reader.result as string);
                reader.onerror = rej;
                reader.readAsDataURL(blob);
            });

            return {
                url: videoDataUrl,
                status: 'success',
                provider: this.provider,
                model: options.modelId
            };

        } catch (err: any) {
            if (err instanceof PollCancelledError) {
                throw err;
            }
            throw new Error(err.message || 'Video generation failed');
        } finally {
            if (options.signal && onAbort) {
                options.signal.removeEventListener('abort', onAbort);
            }
        }
    }

    async checkTaskStatus(taskId: string, mode: GenerationMode, keySlot: KeySlot): Promise<any> {
        if (mode === GenerationMode.VIDEO) {
            const cleanBase = (keySlot.baseUrl || GOOGLE_API_BASE).replace(/\/+$/, '');
            const pollUrl = `${cleanBase}/v1beta/${taskId}`;

            assertNoDirectCall(pollUrl);

            // 获取单次状态
            const response = await forwardUserRouteGenericRequest({
                provider: 'google',
                keyId: keySlot.id,
                url: pollUrl,
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`Check task status failed via proxy: HTTP ${response.status}`);
            }

            const statusData = await response.json();
            if (statusData.error) {
                throw new Error(statusData.error.message || 'Task failed');
            }

            if (statusData.done) {
                const videoUri = statusData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
                if (!videoUri) {
                    throw new Error('No video URI in response');
                }

                const downloadResponse = await forwardUserRouteGenericRequest({
                    provider: 'google',
                    keyId: keySlot.id,
                    url: videoUri,
                    method: 'GET',
                    headers: { 'Accept': 'video/mp4,video/*,*/*' }
                });

                if (!downloadResponse.ok) {
                    throw new Error(`Download video failed: HTTP ${downloadResponse.status}`);
                }

                const blob = await downloadResponse.blob();
                const reader = new FileReader();
                const videoDataUrl = await new Promise<string>((res, rej) => {
                    reader.onloadend = () => res(reader.result as string);
                    reader.onerror = rej;
                    reader.readAsDataURL(blob);
                });

                return {
                    url: videoDataUrl,
                    status: 'success',
                    provider: 'Google',
                    model: 'veo-3.1'
                };
            } else {
                return {
                    status: 'processing',
                    provider: 'Google',
                    model: 'veo-3.1'
                };
            }
        }
        throw new Error(`Polling not supported for mode ${mode} on Google provider`);
    }

    /**
     * Google Audio/Music Generation
     */
    async generateAudio(options: AudioGenerationOptions, keySlot: KeySlot): Promise<AudioGenerationResult> {
        const cleanBase = (keySlot.baseUrl || GOOGLE_API_BASE).replace(/\/+$/, '');

        if (options.modelId.includes('lyria')) {
            // 步骤 A: 移除 URL 中的 ?key= 拼接
            const url = `${cleanBase}/v1beta/models/${options.modelId}:generateContent`;
            
            // 步骤 C: 安全守卫
            assertNoDirectCall(url);

            const payload = {
                contents: [{ role: "user", parts: [{ text: options.prompt }] }],
                generationConfig: {
                    responseModalities: ["AUDIO", "TEXT"]
                }
            };

            // 步骤 B: 替换裸 fetch 为代理转发
            const response = await forwardUserRouteGenericRequest({
                provider: 'google',
                keyId: keySlot.id,
                url,
                method: 'POST',
                rawBody: payload,
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `Lyria Error: ${response.status}`);
            }

            const data = await response.json();
            const audioPart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData || p.inline_data);
            const b64Raw = audioPart?.inlineData?.data || audioPart?.inline_data?.data;
            if (b64Raw) {
                const mimeType = audioPart?.inlineData?.mimeType || audioPart?.inline_data?.mime_type || 'audio/wav';
                const b64 = String(b64Raw).replace(/[\s\r\n]+/g, '');
                return {
                    url: `data:${mimeType};base64,${b64}`,
                    status: 'success',
                    provider: 'Google',
                    model: options.modelId,
                    metadata: {
                        requestPath: '/v1beta/models/:generateContent',
                        requestBodyPreview: buildSafeRequestBodyPreview(payload)
                    }
                };
            }
        }

        // 步骤 A: 移除 URL 中的 ?key= 拼接
        const url = `${cleanBase}/v1beta/models/${options.modelId}:generateContent`;
        
        // 步骤 C: 安全守卫
        assertNoDirectCall(url);

        const payload = {
            contents: [{ role: "user", parts: [{ text: options.prompt }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }
            }
        };

        // 步骤 B: 替换裸 fetch 为代理转发
        const response = await forwardUserRouteGenericRequest({
            provider: 'google',
            keyId: keySlot.id,
            url,
            method: 'POST',
            rawBody: payload,
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `Gemini Audio Error: ${response.status}`);
        }

        const data = await response.json();
        const audioPart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData || p.inline_data);
        const b64Raw = audioPart?.inlineData?.data || audioPart?.inline_data?.data;

        if (b64Raw) {
            const mimeType = audioPart?.inlineData?.mimeType || audioPart?.inline_data?.mime_type || 'audio/wav';
            const b64 = String(b64Raw).replace(/[\s\r\n]+/g, '');
            return {
                url: `data:${mimeType};base64,${b64}`,
                status: 'success',
                provider: 'Google',
                model: options.modelId,
                metadata: {
                    requestPath: '/v1beta/models/:generateContent',
                    requestBodyPreview: buildSafeRequestBodyPreview(payload)
                }
            };
        }

        throw new Error("No audio data in Google response");
    }
}
