/**
 * HTTP 请求内核 (Request Kernel)
 * 提供统一的超时、重试、错误归一化以及流式传输支持
 */

/**
 * 统一请求配置接口
 */
export interface KernelRequestOptions extends Omit<RequestInit, 'signal'> {
    /** 超时时间 (ms)，默认 30000ms，设为 0 表示不限制超时 */
    timeout?: number;
    /** 重试次数，默认 2 次 */
    retries?: number;
    /** 初始重试延迟时间 (ms)，默认 500ms，之后按 2 倍指数退避 */
    retryDelay?: number;
    /** 触发重试的 HTTP 状态码列表，默认 [429, 500, 502, 503] */
    retryOn?: number[];
    /** 支持外部传入的 AbortSignal 用于手动取消请求 */
    signal?: AbortSignal;
}

/**
 * 统一 HTTP 错误类
 */
export class KernelError extends Error {
    /** HTTP 状态码，网络错误为 0，超时通常为 408 */
    public status: number;
    /** 归一化的错误代码 */
    public code: 'TIMEOUT' | 'NETWORK' | 'RATE_LIMIT' | 'AUTH' | 'SERVER' | 'UNKNOWN';
    /** 该错误是否允许被重试 */
    public retryable: boolean;

    constructor(
        message: string,
        status: number,
        code: 'TIMEOUT' | 'NETWORK' | 'RATE_LIMIT' | 'AUTH' | 'SERVER' | 'UNKNOWN',
        retryable: boolean
    ) {
        super(message);
        this.name = 'KernelError';
        this.status = status;
        this.code = code;
        this.retryable = retryable;
        // 保证 instanceof 正常工作
        Object.setPrototypeOf(this, KernelError.prototype);
    }
}

/**
 * 配合 AbortSignal 实现可被提前唤醒的延迟函数
 */
function delayWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            return reject(signal.reason || new DOMException('The user aborted a request.', 'AbortError'));
        }

        const timeoutId = setTimeout(() => {
            if (signal) {
                signal.removeEventListener('abort', onAbort);
            }
            resolve();
        }, ms);

        function onAbort() {
            clearTimeout(timeoutId);
            reject(signal?.reason || new DOMException('The user aborted a request.', 'AbortError'));
        }

        if (signal) {
            signal.addEventListener('abort', onAbort);
        }
    });
}

/**
 * 全局底层请求核心方法，支持流式响应及重试机制
 */
export async function kernelFetch(url: string, options: KernelRequestOptions = {}): Promise<Response> {
    const maxAttempts = (options.retries ?? 2) + 1; // 尝试次数 = 重试次数 + 1
    const initialDelay = options.retryDelay ?? 500;
    const retryOn = options.retryOn ?? [429, 500, 502, 503];
    const timeoutMs = options.timeout ?? 30000;

    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt++;

        // 为单次请求创建独立的 AbortController
        const controller = new AbortController();

        // 绑定外部传入的 AbortSignal
        let externalAbortHandler: (() => void) | null = null;
        if (options.signal) {
            if (options.signal.aborted) {
                throw options.signal.reason || new DOMException('The user aborted a request.', 'AbortError');
            }
            externalAbortHandler = () => {
                controller.abort(options.signal!.reason);
            };
            options.signal.addEventListener('abort', externalAbortHandler);
        }

        // 超时控制器
        let isTimeout = false;
        let timeoutId: any = null;
        if (timeoutMs > 0) {
            timeoutId = setTimeout(() => {
                isTimeout = true;
                controller.abort('timeout');
            }, timeoutMs);
        }

        try {
            // 构建传递给 fetch 的干净配置
            const cleanOptions: RequestInit = { ...options, signal: controller.signal };
            delete (cleanOptions as any).timeout;
            delete (cleanOptions as any).retries;
            delete (cleanOptions as any).retryDelay;
            delete (cleanOptions as any).retryOn;

            // 如果 body 是 FormData，自动移除可能手动指定的 Content-Type 头，
            // 从而使浏览器/运行时自动生成带正确 boundary 的 multipart/form-data 头部。
            if (cleanOptions.body instanceof FormData && cleanOptions.headers) {
                if (cleanOptions.headers instanceof Headers) {
                    cleanOptions.headers.delete('content-type');
                } else if (Array.isArray(cleanOptions.headers)) {
                    cleanOptions.headers = cleanOptions.headers.filter(
                        ([key]) => key.toLowerCase() !== 'content-type'
                    );
                } else if (typeof cleanOptions.headers === 'object') {
                    const headersObj = cleanOptions.headers as Record<string, string>;
                    const keyToDelete = Object.keys(headersObj).find(
                        (k) => k.toLowerCase() === 'content-type'
                    );
                    if (keyToDelete) {
                        delete headersObj[keyToDelete];
                    }
                }
            }

            const response = await fetch(url, cleanOptions);

            // 清理当前尝试的控制器状态
            if (timeoutId) clearTimeout(timeoutId);
            if (externalAbortHandler && options.signal) {
                options.signal.removeEventListener('abort', externalAbortHandler);
            }

            // 请求成功 (2xx) 直接返回 response 对象
            if (response.ok) {
                return response;
            }

            // 处理非 2xx 的异常状态码
            const status = response.status;
            let errCode: KernelError['code'] = 'UNKNOWN';
            let isRetryable = retryOn.includes(status);

            if (status === 429) {
                errCode = 'RATE_LIMIT';
            } else if (status === 401 || status === 403) {
                errCode = 'AUTH';
                isRetryable = false; // 认证错误通常不应当重试
            } else if (status >= 500) {
                errCode = 'SERVER';
            }

            // 复制 response 流读取可能的错误消息
            const responseText = await response.clone().text().catch(() => '');
            const errorMsg = `HTTP Error ${status}: ${response.statusText || ''} - ${responseText}`;
            const kernelErr = new KernelError(errorMsg, status, errCode, isRetryable);

            // 判断是否进行重试
            if (isRetryable && attempt < maxAttempts) {
                const delay = initialDelay * Math.pow(2, attempt - 1);
                await delayWithSignal(delay, options.signal);
                continue;
            }

            throw kernelErr;

        } catch (err: any) {
            // 清理当前尝试的控制器状态
            if (timeoutId) clearTimeout(timeoutId);
            if (externalAbortHandler && options.signal) {
                options.signal.removeEventListener('abort', externalAbortHandler);
            }

            // 情况 A：用户主动触发的取消，直接向外抛出，不重试
            if (err.name === 'AbortError' && !isTimeout && err.message !== 'timeout' && controller.signal.reason !== 'timeout') {
                throw err;
            }

            // 情况 B：请求超时
            if (isTimeout || (err.name === 'AbortError' && (err.message === 'timeout' || controller.signal.reason === 'timeout'))) {
                const kernelErr = new KernelError('Request timed out', 408, 'TIMEOUT', true);
                if (attempt < maxAttempts) {
                    const delay = initialDelay * Math.pow(2, attempt - 1);
                    await delayWithSignal(delay, options.signal);
                    continue;
                }
                throw kernelErr;
            }

            // 情况 C：已经是归一化后的 KernelError，直接抛出或重试
            if (err instanceof KernelError) {
                if (err.retryable && attempt < maxAttempts) {
                    const delay = initialDelay * Math.pow(2, attempt - 1);
                    await delayWithSignal(delay, options.signal);
                    continue;
                }
                throw err;
            }

            // 情况 D：物理断网或其他未分类的 fetch 网络报错
            const kernelErr = new KernelError(err.message || 'Network request failed', 0, 'NETWORK', true);
            if (attempt < maxAttempts) {
                const delay = initialDelay * Math.pow(2, attempt - 1);
                await delayWithSignal(delay, options.signal);
                continue;
            }
            throw kernelErr;
        }
    }

    throw new KernelError('Request failed after max retry attempts', 0, 'UNKNOWN', false);
}

/**
 * 统一的 JSON 请求快捷辅助方法
 */
export async function kernelJSON<T>(url: string, options?: KernelRequestOptions): Promise<T> {
    const response = await kernelFetch(url, options);
    try {
        return await response.json() as T;
    } catch (err: any) {
        throw new KernelError(
            `Failed to parse JSON response: ${err.message}`,
            response.status,
            'UNKNOWN',
            false
        );
    }
}
