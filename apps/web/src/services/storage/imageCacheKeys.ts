/**
 * 图片缓存键推导与再水合顺序契约
 *
 * 拆成独立零 IO 模块的原因：这两段逻辑是「重试能否真正重新读取」的核心，
 * 但 imageStorage.ts 闭包了 IndexedDB、OPFS、本地磁盘句柄，无法在单元测试中直接驱动。
 * 这里只保留纯函数与依赖注入版本，由 imageStorage 提供真实依赖。
 */

import { ImageQuality, getQualityStorageId } from '../image/imageQuality.ts';

export interface ImageCacheKeyOptions {
    /** 是否连同 _micro/_thumb/_preview 派生档位一起失效，默认 true */
    includeDerivedQualities?: boolean;
}

/**
 * 推导一个逻辑图片 id 需要失效的全部缓存键。
 * ORIGINAL 档不带后缀（即裸 id），其余档位为 `${id}_${quality}`。
 */
export function buildImageCacheInvalidationKeys(
    ids: ReadonlyArray<string | undefined | null>,
    options: ImageCacheKeyOptions = {},
): string[] {
    const { includeDerivedQualities = true } = options;
    const keys: string[] = [];
    const seen = new Set<string>();

    for (const raw of ids) {
        const id = typeof raw === 'string' ? raw.trim() : '';
        if (!id) continue;

        const candidates = includeDerivedQualities
            ? Object.values(ImageQuality).map((quality) => getQualityStorageId(id, quality))
            : [id];

        for (const key of candidates) {
            if (seen.has(key)) continue;
            seen.add(key);
            keys.push(key);
        }
    }

    return keys;
}

export interface RehydrateDeps {
    /** 同步逐出内存缓存，返回被逐出的键 */
    invalidate: (id: string) => string[];
    /** 严格读取受保护原图（不查内存缓存） */
    readStrictOriginal: (id: string) => Promise<string | null>;
    /** 常规读取（含各级回落） */
    read: (id: string) => Promise<string | null>;
    /** 按档位读取 */
    readByQuality: (id: string, quality: ImageQuality) => Promise<string | null>;
}

/**
 * 再水合的顺序契约：必须先失效、再读取，否则读取会命中内存快路径并原样返回
 * 那个已经失效的 URL —— 这正是「点了重试还是坏图」的根因。
 *
 * 依赖注入版本，便于在无浏览器环境下断言调用顺序。
 */
export async function rehydrateWith(
    id: string,
    quality: ImageQuality,
    deps: RehydrateDeps,
): Promise<string | null> {
    deps.invalidate(id);

    if (quality === ImageQuality.ORIGINAL) {
        return (await deps.readStrictOriginal(id)) ?? (await deps.read(id));
    }

    return deps.readByQuality(id, quality);
}
