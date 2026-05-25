/**
 * 自定义错误类：轮询超时错误
 */
export class PollTimeoutError extends Error {
    constructor(message: string = '轮询任务超时') {
        super(message);
        this.name = 'PollTimeoutError';
        Object.setPrototypeOf(this, PollTimeoutError.prototype);
    }
}

/**
 * 自定义错误类：任务执行失败错误
 */
export class PollFailedError<T> extends Error {
    public readonly lastResult: T;
    constructor(message: string, lastResult: T) {
        super(message);
        this.name = 'PollFailedError';
        this.lastResult = lastResult;
        Object.setPrototypeOf(this, PollFailedError.prototype);
    }
}

/**
 * 自定义错误类：轮询被取消错误
 */
export class PollCancelledError extends Error {
    constructor(message: string = '轮询任务已被取消') {
        super(message);
        this.name = 'PollCancelledError';
        Object.setPrototypeOf(this, PollCancelledError.prototype);
    }
}

/**
 * 轮询配置参数接口
 */
export interface PollConfig<TSubmitResult, TPollResult> {
    /** 提交任务的函数，支持接收 AbortSignal */
    submitFn: (signal?: AbortSignal) => Promise<TSubmitResult>;
    
    /** 轮询查询结果的函数，接收任务 ID 和 AbortSignal */
    pollFn: (id: string, signal?: AbortSignal) => Promise<TPollResult>;
    
    /** 判断轮询结果是否代表任务已完成 */
    isDone: (result: TPollResult) => boolean;
    
    /** 判断轮询结果是否代表任务已失败 */
    isFailed: (result: TPollResult) => boolean;
    
    /** 从提交结果中提取任务 ID */
    extractId: (submit: TSubmitResult) => string;
    
    /** 
     * 轮询查询间隔，单位为毫秒（默认 2000ms）。
     * 支持传入计算函数以实现指数退避等自定义等待策略。
     * @param pollCount 当前已完成的轮询查询次数
     * @param elapsed 距离轮询开始已流逝的毫秒数
     */
    interval?: number | ((pollCount: number, elapsed: number) => number);
    
    /** 最大等待时间，单位为毫秒（默认 300000ms，即 5 分钟） */
    maxWait?: number;
    
    /** 进度回调函数，每次成功轮询后触发 */
    onProgress?: (result: TPollResult) => void;
    
    /** 
     * 可选：如果提交结果中已经包含最终轮询结果（例如任务立即完成，无需轮询），
     * 可以通过此函数将其转换为 TPollResult 并直接返回。
     */
    checkSubmitDone?: (submit: TSubmitResult) => TPollResult | undefined;
}

export type PollStatus = 'idle' | 'polling' | 'done' | 'failed' | 'cancelled';

/**
 * 统一的异步任务轮询管理器
 */
export class AsyncTaskPoller<TSubmitResult, TPollResult> {
    private readonly config: Required<Omit<PollConfig<TSubmitResult, TPollResult>, 'onProgress' | 'checkSubmitDone'>> & {
        onProgress?: (result: TPollResult) => void;
        checkSubmitDone?: (submit: TSubmitResult) => TPollResult | undefined;
    };
    private status: PollStatus = 'idle';
    private abortController: AbortController | null = null;

    constructor(config: PollConfig<TSubmitResult, TPollResult>) {
        this.config = {
            interval: 2000,
            maxWait: 300000,
            ...config,
        };
    }

    /**
     * 获取当前轮询器状态
     */
    public getStatus(): PollStatus {
        return this.status;
    }

    /**
     * 开始执行：提交任务 -> 轮询 -> 返回最终完成的结果
     * @throws {PollTimeoutError} 超时未完成
     * @throws {PollFailedError} 任务状态判定为失败
     * @throws {PollCancelledError} 手动取消或被外部中止
     * @throws {Error} 提交任务错误或重试后仍失败的网络错误
     */
    public async start(): Promise<TPollResult> {
        if (this.status === 'polling') {
            throw new Error('轮询器已在运行中');
        }

        this.status = 'polling';
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
            // 1. 提交任务
            if (signal.aborted) {
                throw new PollCancelledError();
            }
            const submitResult = await this.config.submitFn(signal);

            // 检查是否可以直接完成，跳过轮询
            if (this.config.checkSubmitDone) {
                const immediateResult = this.config.checkSubmitDone(submitResult);
                if (immediateResult !== undefined) {
                    this.status = 'done';
                    return immediateResult;
                }
            }

            // 2. 提取任务 ID
            const taskId = this.config.extractId(submitResult);
            if (!taskId) {
                throw new Error('无法从任务提交结果中提取有效的任务 ID');
            }

            // 3. 开始循环轮询
            const startTime = Date.now();
            const maxWait = this.config.maxWait;
            let pollCount = 0;

            while (true) {
                if (signal.aborted) {
                    throw new PollCancelledError();
                }

                // 校验主超时
                const elapsed = Date.now() - startTime;
                if (elapsed >= maxWait) {
                    throw new PollTimeoutError(`任务超时：已等待 ${elapsed}ms，最大限制 ${maxWait}ms`);
                }

                // 每次轮询失败，在其内部自动重试 3 次
                const pollResult = await this.executePollWithRetry(taskId, signal);
                pollCount++;

                // 进度通知
                if (this.config.onProgress) {
                    this.config.onProgress(pollResult);
                }

                // 检查是否完成
                if (this.config.isDone(pollResult)) {
                    this.status = 'done';
                    return pollResult;
                }

                // 检查是否失败
                if (this.config.isFailed(pollResult)) {
                    throw new PollFailedError('异步任务执行失败', pollResult);
                }

                // 计算下一次等待间隔，防超时溢出
                let nextInterval = 2000;
                if (typeof this.config.interval === 'number') {
                    nextInterval = this.config.interval;
                } else if (typeof this.config.interval === 'function') {
                    nextInterval = this.config.interval(pollCount, Date.now() - startTime);
                }

                const remainingTime = maxWait - (Date.now() - startTime);
                if (remainingTime <= 0) {
                    throw new PollTimeoutError(`任务超时：最大限制 ${maxWait}ms`);
                }

                const currentDelay = Math.min(nextInterval, remainingTime);

                // 可被 AbortSignal 中断的精确等待
                await this.delay(currentDelay, signal);
            }
        } catch (error: any) {
            if (error instanceof PollCancelledError || signal.aborted || error?.name === 'AbortError') {
                this.status = 'cancelled';
                throw new PollCancelledError();
            }
            if (error instanceof PollFailedError || error instanceof PollTimeoutError) {
                this.status = 'failed';
                throw error;
            }
            this.status = 'failed';
            throw error;
        } finally {
            this.cleanup();
        }
    }

    /**
     * 取消轮询操作，中断底层 API 请求和挂起的定时器
     */
    public cancel(): void {
        if (this.status !== 'polling') {
            return;
        }
        this.status = 'cancelled';
        if (this.abortController) {
            this.abortController.abort();
        }
        this.cleanup();
    }

    /**
     * 支持自动网络重试的 poll 逻辑
     */
    private async executePollWithRetry(id: string, signal: AbortSignal): Promise<TPollResult> {
        let attempts = 0;
        const maxAttempts = 3; // 失败后最多重试 3 次（共 4 次请求）
        while (true) {
            if (signal.aborted) {
                throw new PollCancelledError();
            }
            try {
                return await this.config.pollFn(id, signal);
            } catch (error: any) {
                if (signal.aborted || error instanceof PollCancelledError || error?.name === 'AbortError') {
                    throw new PollCancelledError();
                }

                attempts++;
                if (attempts > maxAttempts) {
                    throw error; // 重试超限，将网络异常向外抛出
                }

                // 网络异常后进行短延迟避让（1000ms），不计入主循环间隔
                await this.delay(1000, signal);
            }
        }
    }

    /**
     * 基于 Promise 与 AbortSignal 联动的可中断延时
     */
    private delay(ms: number, signal: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            if (signal.aborted) {
                return reject(new PollCancelledError());
            }

            const timer = setTimeout(() => {
                signal.removeEventListener('abort', onAbort);
                resolve();
            }, ms);

            function onAbort() {
                clearTimeout(timer);
                reject(new PollCancelledError());
            }

            signal.addEventListener('abort', onAbort);
        });
    }

    /**
     * 清理状态
     */
    private cleanup(): void {
        this.abortController = null;
    }
}
