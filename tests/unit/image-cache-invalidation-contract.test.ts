import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const ROOT_DIR = process.cwd();

function readWebSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, 'apps', 'web', 'src', relativePath), 'utf8');
}

// ---------------------------------------------------------------------------
// imageCacheKeys.ts 是零 IO 纯模块，可直接转译执行；只需桩掉 imageQuality。
// ---------------------------------------------------------------------------

const ImageQuality = {
  MICRO: 'micro',
  THUMBNAIL: 'thumb',
  PREVIEW: 'preview',
  ORIGINAL: 'original',
} as const;

function getQualityStorageId(id: string, quality: string): string {
  return quality === ImageQuality.ORIGINAL ? id : `${id}_${quality}`;
}

function loadImageCacheKeysModule() {
  const source = readWebSource('services/storage/imageCacheKeys.ts');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const moduleShim: { exports: Record<string, any> } = { exports: {} };
  const requireShim = (specifier: string) => {
    if (specifier === '../image/imageQuality.ts') {
      return { ImageQuality, getQualityStorageId };
    }
    throw new Error(`Unexpected import in imageCacheKeys.ts: ${specifier}`);
  };

  // eslint-disable-next-line no-new-func
  new Function('require', 'exports', 'module', transpiled)(requireShim, moduleShim.exports, moduleShim);
  return moduleShim.exports;
}

const cacheKeys = loadImageCacheKeysModule();

test('buildImageCacheInvalidationKeys covers every derived tier plus the bare original key', () => {
  const keys = cacheKeys.buildImageCacheInvalidationKeys(['img-1']);

  assert.deepEqual(keys, ['img-1_micro', 'img-1_thumb', 'img-1_preview', 'img-1']);
});

test('buildImageCacheInvalidationKeys dedupes, trims and drops empty ids', () => {
  const keys = cacheKeys.buildImageCacheInvalidationKeys(['img-1', '  img-1  ', '', null, undefined, 'img-2']);

  assert.equal(keys.filter((k: string) => k === 'img-1').length, 1);
  assert.ok(keys.includes('img-2'));
  assert.ok(!keys.some((k: string) => k.startsWith('_')), '空 id 不得产出裸后缀键');
});

test('buildImageCacheInvalidationKeys can narrow to the original key only', () => {
  const keys = cacheKeys.buildImageCacheInvalidationKeys(['img-1'], { includeDerivedQualities: false });

  assert.deepEqual(keys, ['img-1']);
});

test('rehydrateWith invalidates before reading so the memory fast path cannot serve a stale url', async () => {
  const calls: string[] = [];
  const url = await cacheKeys.rehydrateWith('img-1', ImageQuality.ORIGINAL, {
    invalidate: (id: string) => {
      calls.push(`invalidate:${id}`);
      return [id];
    },
    readStrictOriginal: async (id: string) => {
      calls.push(`strict:${id}`);
      return 'blob:fresh';
    },
    read: async (id: string) => {
      calls.push(`read:${id}`);
      return null;
    },
    readByQuality: async () => {
      calls.push('byQuality');
      return null;
    },
  });

  assert.equal(url, 'blob:fresh');
  // 顺序是本修复的核心：先失效、后读取。反过来读取会命中内存缓存并原样
  // 返回那个已经失效的 URL，重试就永远无法自愈。
  assert.deepEqual(calls, ['invalidate:img-1', 'strict:img-1']);
});

test('rehydrateWith falls back to the regular read when the protected original is missing', async () => {
  const calls: string[] = [];
  const url = await cacheKeys.rehydrateWith('img-1', ImageQuality.ORIGINAL, {
    invalidate: () => [],
    readStrictOriginal: async () => {
      calls.push('strict');
      return null;
    },
    read: async () => {
      calls.push('read');
      return 'blob:recovered';
    },
    readByQuality: async () => {
      calls.push('byQuality');
      return null;
    },
  });

  assert.equal(url, 'blob:recovered');
  assert.deepEqual(calls, ['strict', 'read']);
});

test('rehydrateWith routes non-original tiers through the quality reader only', async () => {
  const calls: string[] = [];
  const url = await cacheKeys.rehydrateWith('img-1', ImageQuality.THUMBNAIL, {
    invalidate: () => [],
    readStrictOriginal: async () => {
      calls.push('strict');
      return 'blob:should-not-be-used';
    },
    read: async () => {
      calls.push('read');
      return 'blob:should-not-be-used';
    },
    readByQuality: async (_id: string, quality: string) => {
      calls.push(`byQuality:${quality}`);
      return 'blob:thumb';
    },
  });

  assert.equal(url, 'blob:thumb');
  assert.deepEqual(calls, ['byQuality:thumb']);
});

// ---------------------------------------------------------------------------
// imageStorage / ImageCard2 闭包了 IndexedDB 与 React，以源码契约断言守护。
// ---------------------------------------------------------------------------

test('invalidateImageCache evicts without revoking shared blob urls by default', () => {
  const source = readWebSource('services/storage/imageStorage.ts');

  assert.match(source, /export function invalidateImageCache/);
  assert.match(source, /memoryCache\.evict\(key\)/, '默认路径必须只逐出');
  assert.match(
    source,
    /if \(options\.revokeObjectUrls\) \{\s*memoryCache\.delete\(key\);\s*\} else \{\s*memoryCache\.evict\(key\);/,
    'revoke 必须是显式 opt-in，默认逐出'
  );
  assert.match(source, /evict\(id: string\): boolean \{\s*return this\.cache\.delete\(id\);\s*\}/, 'evict 不得 revoke');
});

test('rehydrateImage delegates to the shared ordering contract instead of duplicating it', () => {
  const source = readWebSource('services/storage/imageStorage.ts');

  assert.match(source, /export async function rehydrateImage/);
  assert.match(source, /return rehydrateWith\(id, quality, \{/, '必须复用 rehydrateWith，避免顺序契约出现第二份实现');
});

test('the media retry control is actually rendered and resets the auto-retry ladder', () => {
  const source = readWebSource('components/image/ImageCard2.tsx');

  // 回归守护：handleRetryLoad 曾长期是不可达死代码，没有任何 JSX 绑定它。
  const bindings = source.match(/onClick=\{handleRetryLoad\}/g) || [];
  assert.ok(bindings.length >= 2, `重试按钮必须同时挂在内联错误态与覆盖层，实际绑定 ${bindings.length} 处`);

  assert.match(source, /invalidateImageCache\(imageStorageKey\)/, '重试必须失效缓存，否则读回同一个坏 URL');
  assert.match(source, /autoRetryRef\.current = 0;/, '重试必须复位自动重试阶梯');

  // 重试期间按钮必须保持挂载并给出进行中反馈，否则点一下就消失、用户以为没反应。
  assert.match(source, /disabled=\{isLoading\}/);
  assert.match(source, /\{isLoading \? '重试中…' : '重试加载'\}/);

  // 卡片在 onMouseDown/onTouchStart 上起拖，拦 onPointerDown 是空操作。
  assert.match(source, /onMouseDown=\{stopMediaPointerPropagation\}/);
  assert.doesNotMatch(
    source,
    /onClick=\{handleRetryLoad\}\s*\n\s*onPointerDown=/,
    '不得用 onPointerDown 阻断拖拽'
  );
});
