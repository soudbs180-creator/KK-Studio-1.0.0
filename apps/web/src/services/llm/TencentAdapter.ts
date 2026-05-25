import { LLMAdapter, ChatOptions, ImageGenerationOptions } from './LLMAdapter';
import { KeySlot } from '../auth/keyManager';
import { assertNoDirectCall } from '../../utils/security';
import { forwardUserRouteGenericRequest } from '../model/secureModelProxy';
import { AsyncTaskPoller, PollCancelledError } from '../http/AsyncTaskPoller';

export class TencentAdapter implements LLMAdapter {
    id = 'tencent-adapter';
    provider = 'Tencent';

    supports(modelId: string): boolean {
        return modelId.startsWith('hunyuan');
    }

    async chat(options: ChatOptions, keySlot: KeySlot): Promise<string> {
        if (keySlot.baseUrl) {
            return this.openaiFetch(options, keySlot);
        }
        throw new Error("Tencent Chat requires a Base URL (Proxy) or full SDK implementation.");
    }

    private async openaiFetch(options: ChatOptions, keySlot: KeySlot): Promise<string> {
        const url = `${keySlot.baseUrl}/chat/completions`;
        
        // 安全守卫
        assertNoDirectCall(url);

        const response = await forwardUserRouteGenericRequest(
            url,
            'POST',
            keySlot.id,
            JSON.stringify({
                model: options.modelId,
                messages: options.messages.map(m => ({ role: m.role, content: m.content })),
                stream: false
            }),
            { 'Content-Type': 'application/json' },
            options.signal,
        );

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`腾讯 API 错误 ${response.status}: ${errText.slice(0, 300)}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    async generateImage(options: ImageGenerationOptions, keySlot: KeySlot): Promise<import('./LLMAdapter').ImageGenerationResult> {
        const submitUrl = `${keySlot.baseUrl}/v1/images/generations`;

        // 安全守卫
        assertNoDirectCall(submitUrl);

        // 提交任务到代理
        const taskResponse = await forwardUserRouteGenericRequest(
            submitUrl,
            'POST',
            keySlot.id,
            JSON.stringify({
                model: options.modelId,
                prompt: options.prompt,
                size: '1024x1024',
                n: 1
            }),
            { 'Content-Type': 'application/json', 'X-Async-Task': 'true' },
            options.signal,
        );

        if (!taskResponse.ok) {
            const errText = await taskResponse.text().catch(() => '');
            throw new Error(`腾讯图像提交 API 错误 ${taskResponse.status}: ${errText.slice(0, 300)}`);
        }

        const taskData = await taskResponse.json();
        const taskId = taskData.id || taskData.task_id;

        if (!taskId) {
            if (taskData.data && taskData.data.length > 0) {
                return { urls: taskData.data.map((d: any) => d.url) };
            }
            throw new Error(`Failed to get Task ID from Tencent API: ${JSON.stringify(taskData)}`);
        }

        // 轮询：接入 AsyncTaskPoller
        const pollUrl = `${keySlot.baseUrl}/v1/tasks/${taskId}`;
        
        const poller = new AsyncTaskPoller<any, any>({
            submitFn: async () => ({ taskId }),
            pollFn: async (id, signal) => {
                const pollResponse = await forwardUserRouteGenericRequest(
                    pollUrl,
                    'GET',
                    keySlot.id,
                    undefined,
                    undefined,
                    signal,
                );
                if (!pollResponse.ok) {
                    throw new Error(`腾讯轮询请求错误: ${pollResponse.status}`);
                }
                return await pollResponse.json().catch(() => ({}));
            },
            extractId: (submit) => submit.taskId,
            isDone: (result) => {
                const status = String(result.JobStatus || result.Status || result.status || '').toUpperCase();
                return status === 'SUCCEEDED' || status === 'SUCCESS' || status === 'DONE';
            },
            isFailed: (result) => {
                const status = String(result.JobStatus || result.Status || result.status || '').toUpperCase();
                return status === 'FAILED' || status === 'ERROR';
            },
            interval: 2000,
            maxWait: 10 * 60 * 1000,
        });

        // 联动取消信号
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
            const urls = pollResult.data?.map((d: any) => d.url) || [];
            if (!urls.length && pollResult.url) {
                urls.push(pollResult.url);
            }
            return { urls };
        } catch (err: any) {
            if (err instanceof PollCancelledError) {
                throw err;
            }
            throw new Error(err.message || '腾讯图像生成轮询失败');
        } finally {
            if (options.signal && onAbort) {
                options.signal.removeEventListener('abort', onAbort);
            }
        }
    }
}
