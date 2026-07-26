/**
 * 图片加载队列服务 - 限制并发请求数，优化加载性能
 * 
 * 内核功能：
 * 1. 限制最大并发请求数（避免阻塞浏览器）
 * 2. 支持优先级调整（可见图片优先加载）
 * 3. 支持取消请求（离开视口时取消）
 */

import { getImage, getImageByQuality, getStrictOriginalImage } from '../storage/imageStorage';
import { ImageQuality } from './imageQuality';

// 最大并发请求数（浏览器同域限制约6个）
const MAX_CONCURRENT = 6;

interface QueueItem {
    imageId: string;
    quality: ImageQuality;
    priority: number;          // 越大越优先
    resolve: (url: string | null) => void;
    reject: (error: Error) => void;
    cancelled: boolean;
}

class ImageLoaderQueue {
    private queue: QueueItem[] = [];
    private activeCount = 0;
    private processing = false;

    /**
     * 加载图片（加入队列）
     */
    load(imageId: string, quality: ImageQuality = ImageQuality.PREVIEW, priority = 0): Promise<string | null> {
        return new Promise((resolve, reject) => {
            // 检查是否已在队列中
            const existing = this.queue.find(q => q.imageId === imageId && q.quality === quality);
            if (existing) {
                // 更新优先级（取更高的）
                existing.priority = Math.max(existing.priority, priority);
                // 链式Promise
                const originalResolve = existing.resolve;
                existing.resolve = (url) => {
                    originalResolve(url);
                    resolve(url);
                };
                return;
            }

            this.queue.push({
                imageId,
                quality,
                priority,
                resolve,
                reject,
                cancelled: false
            });

            this.processQueue();
        });
    }

    /**
     * 提升优先级（用于即将可见的图片）
     */
    prioritize(imageId: string, boost = 100): void {
        const item = this.queue.find(q => q.imageId === imageId);
        if (item) {
            item.priority += boost;
            // 重新排序队列
            this.sortQueue();
        }
    }

    /**
     * 取消请求（用于离开视口的图片）
     *
     * quality 省略时取消该图片的全部在途请求（离开视口场景）；传入 quality 时
     * 只取消该档位。视口预取与卡片自身加载常常并存于不同档位，若不区分档位，
     * 预取清理会连带把卡片正在等待的 Promise 以 null 兑现（load() 对同 key 请求
     * 做了 Promise 链式合并），卡片随即落入失败重试阶梯，表现为“已有 ID 却长时间白屏”。
     */
    cancel(imageId: string, quality?: ImageQuality): void {
        const matches = (item: QueueItem) =>
            item.imageId === imageId && (quality === undefined || item.quality === quality);

        const targets = this.queue.filter(matches);
        if (targets.length === 0) {
            return;
        }

        targets.forEach(item => {
            item.cancelled = true;
            item.resolve(null);
        });
        this.queue = this.queue.filter(item => !matches(item));
    }

    /**
     * 取消所有请求（用于画布切换）
     */
    cancelAll(): void {
        this.queue.forEach(item => {
            item.cancelled = true;
            item.resolve(null);
        });
        this.queue = [];
    }

    /**
     * 获取队列状态
     */
    getStatus(): { queued: number; active: number } {
        return {
            queued: this.queue.length,
            active: this.activeCount
        };
    }

    private sortQueue(): void {
        // 高优先级排前面
        this.queue.sort((a, b) => b.priority - a.priority);
    }

    private async processQueue(): Promise<void> {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0 && this.activeCount < MAX_CONCURRENT) {
            this.sortQueue();
            const item = this.queue.shift();
            if (!item || item.cancelled) continue;

            this.activeCount++;

            // 异步加载，不阻塞循环
            this.loadItem(item).finally(() => {
                this.activeCount--;
                // 继续处理队列
                if (this.queue.length > 0) {
                    this.processQueue();
                }
            });
        }

        this.processing = false;
    }

    private async loadItem(item: QueueItem): Promise<void> {
        if (item.cancelled) {
            item.resolve(null);
            return;
        }

        try {
            let url: string | null = null;

            if (item.quality === ImageQuality.ORIGINAL) {
                url = await getStrictOriginalImage(item.imageId);
                if (!url) {
                    url = await getImage(item.imageId);
                }
            } else {
                url = await getImageByQuality(item.imageId, item.quality);
            }

            if (!item.cancelled) {
                item.resolve(url);
            }
        } catch (error) {
            if (!item.cancelled) {
                console.error(`[ImageLoader] Failed to load ${item.imageId}:`, error);
                item.resolve(null); // 失败时返回null而不是reject，避免级联错误
            }
        }
    }
}

// 单例导出
export const imageLoader = new ImageLoaderQueue();

// 便捷方法
export function loadImage(imageId: string, quality?: ImageQuality, priority?: number): Promise<string | null> {
    return imageLoader.load(imageId, quality, priority);
}

export function cancelImageLoad(imageId: string, quality?: ImageQuality): void {
    imageLoader.cancel(imageId, quality);
}

export function prioritizeImage(imageId: string): void {
    imageLoader.prioritize(imageId);
}

export default imageLoader;
