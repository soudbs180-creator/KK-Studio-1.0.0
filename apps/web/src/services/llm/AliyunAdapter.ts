import { type LLMAdapter, type ChatOptions, type ImageGenerationOptions} from './LLMAdapter';
import { type KeySlot} from '../auth/keyManager';
import { assertNoDirectCall } from '../../utils/security';
import { forwardUserRouteGenericRequest } from '../model/secureModelProxy';

export class AliyunAdapter implements LLMAdapter {
    id = 'aliyun-adapter';
    provider = 'Aliyun';

    supports(modelId: string): boolean {
        return modelId.startsWith('qwen') || modelId.startsWith('wanx');
    }

    async chat(options: ChatOptions, keySlot: KeySlot): Promise<string> {
        // DashScope / OpenAI Compatible
        // Aliyun DashScope is OpenAI compatible at https://dashscope.aliyuncs.com/compatible-mode/v1
        const baseUrl = keySlot.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

        return this.openaiFetch(baseUrl, options, keySlot);
    }

    async generateImage(options: ImageGenerationOptions, keySlot: KeySlot): Promise<import('./LLMAdapter').ImageGenerationResult> {
        const baseUrl = keySlot.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        const url = `${baseUrl}/images/generations`;

        // 步骤 C: 安全守卫
        assertNoDirectCall(url);

        // 步骤 B & A: 改为代理转发，彻底下沉密钥
        const response = await forwardUserRouteGenericRequest({
            provider: 'aliyun',
            keyId: keySlot.id,
            url,
            method: 'POST',
            rawBody: {
                model: options.modelId, // e.g. wanx-v1
                prompt: options.prompt,
                n: options.imageCount || 1,
                size: '1024x1024' // Validate supported sizes for Wanx
            },
            headers: {
                'Content-Type': 'application/json'
            },
            signal: options.signal
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `Aliyun Error: ${response.status}`);
        }

        const data = await response.json();
        const urls = data.data.map((d: any) => d.url || d.b64_json);

        return { urls };
    }

    private async openaiFetch(baseUrl: string, options: ChatOptions, keySlot: KeySlot): Promise<string> {
        const url = `${baseUrl}/chat/completions`;

        // 步骤 C: 安全守卫
        assertNoDirectCall(url);

        // 步骤 B & A: 改为代理转发，彻底下沉密钥
        const response = await forwardUserRouteGenericRequest({
            provider: 'aliyun',
            keyId: keySlot.id,
            url,
            method: 'POST',
            rawBody: {
                model: options.modelId,
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
            throw new Error(err.error?.message || `Aliyun Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }
}
