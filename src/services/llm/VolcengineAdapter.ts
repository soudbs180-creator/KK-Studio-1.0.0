import { LLMAdapter, ChatOptions, ImageGenerationOptions } from './LLMAdapter';
import { KeySlot } from '../auth/keyManager';
import { assertNoDirectCall } from '../../utils/security';
import { forwardUserRouteGenericRequest } from '../model/secureModelProxy';

export class VolcengineAdapter implements LLMAdapter {
    id = 'volcengine-adapter';
    provider = 'Volcengine';

    supports(_modelId: string): boolean {
        // Volcengine uses Endpoint IDs (e.g. ep-2024...) usually.
        // Or Doubao-* names if using a proxy.
        // We match broadly or specific prefix if we can, but since Endpoint IDs are custom,
        // we might rely on the Provider being set to Volcengine in the KeySlot.
        return true;
    }

    async chat(options: ChatOptions, keySlot: KeySlot): Promise<string> {
        // Ark is OpenAI Compatible
        // Base URL: https://ark.cn-beijing.volces.com/api/v3
        const baseUrl = keySlot.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';

        // IMPORTANT: Volcengine requires the MODEL parameter to be the ENDPOINT ID.
        // If the user configured an endpointId in providerConfig, use that.
        // Otherwise assume options.modelId IS the endpoint ID.
        const model = keySlot.providerConfig?.endpointId || options.modelId;

        const url = `${baseUrl}/chat/completions`;

        // 步骤 C: 安全守卫
        assertNoDirectCall(url);

        // 步骤 B & A: 改为代理转发，彻底下沉密钥
        const response = await forwardUserRouteGenericRequest({
            provider: 'volcengine',
            keyId: keySlot.id,
            url,
            method: 'POST',
            rawBody: {
                model: model,
                messages: options.messages.map(m => ({ role: m.role, content: m.content })),
                stream: false
            },
            headers: {
                'Content-Type': 'application/json'
            },
            signal: options.signal
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `Volcengine Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    async generateImage(options: ImageGenerationOptions, keySlot: KeySlot): Promise<import('./LLMAdapter').ImageGenerationResult> {
        // Ark currently focuses on Chat/Embedding. 
        // For CV (Images), they have specific CV endpoints or standard OpenAI image interface on some proxies.
        // Assuming OpenAI compatible interface if available.
        // If not, we might fail or need specific implementation.
        // Currently assuming standard OpenAI format as per user request for "Multi-Provider".
        const baseUrl = keySlot.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
        // Check if they support /v1/images/generations (or /api/v3/images/generations)
        // Actually, Volcengine Image Gen often uses different service (Visual Intelligence).
        // But let's try the OpenAI compatible path first.
        const url = `${baseUrl}/images/generations`;

        const model = keySlot.providerConfig?.endpointId || options.modelId;

        // 步骤 C: 安全守卫
        assertNoDirectCall(url);

        // 步骤 B & A: 改为代理转发，彻底下沉密钥
        const response = await forwardUserRouteGenericRequest({
            provider: 'volcengine',
            keyId: keySlot.id,
            url,
            method: 'POST',
            rawBody: {
                model: model,
                prompt: options.prompt,
                size: '1024x1024'
            },
            headers: {
                'Content-Type': 'application/json'
            },
            signal: options.signal
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `Volcengine Image Error: ${response.status}`);
        }

        const data = await response.json();
        const urls = data.data.map((d: any) => d.url || d.b64_json);
        return { urls };
    }
}
