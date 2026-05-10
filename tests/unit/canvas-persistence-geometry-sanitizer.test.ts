import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { restoreCanvasStateFromLocalStorage } from '../../src/context/canvasPersistence.ts';
import { sanitizePersistedCanvases } from '../../src/context/canvasGeometrySanitizer.ts';

const ROOT_DIR = process.cwd();

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function withLocalStorage<T>(storage: MemoryStorage, callback: () => T): T {
  const globalLike = globalThis as typeof globalThis & { localStorage?: unknown };
  const previous = globalLike.localStorage;
  globalLike.localStorage = storage;

  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete globalLike.localStorage;
    } else {
      globalLike.localStorage = previous;
    }
  }
}

test('restored canvas state rejects corrupted persisted geometry before render', () => {
  const [canvas] = sanitizePersistedCanvases([
    {
      id: 'canvas-1',
      name: 'Broken canvas',
      lastModified: 1,
      promptNodes: [
        {
          id: 'prompt-1',
          prompt: 'prompt',
          position: { x: Number.NaN, y: 1200000 },
          height: 8,
          width: 12,
          childImageIds: [],
          timestamp: 1,
        },
      ],
      imageNodes: [
        {
          id: 'image-1',
          url: '',
          prompt: '',
          timestamp: 1,
          canvasId: 'canvas-1',
          parentPromptId: 'prompt-1',
          position: { x: -900000, y: Number.POSITIVE_INFINITY },
        },
      ],
      groups: [],
      drawings: [],
      workflow: {
        version: 1,
        nodes: [
          {
            id: 'workflow-1',
            kind: 'preview',
            position: { x: Number.NEGATIVE_INFINITY, y: 999999 },
            width: 24,
            height: 20,
            data: {},
          },
        ],
        edges: [],
      },
    },
  ] as any);

  assert.deepEqual(canvas.promptNodes[0].position, { x: 0, y: 0 });
  assert.equal(canvas.promptNodes[0].height, undefined);
  assert.equal(canvas.promptNodes[0].width, undefined);
  assert.deepEqual(canvas.imageNodes[0].position, { x: 0, y: 0 });
  assert.deepEqual(canvas.workflow?.nodes[0].position, { x: 0, y: 0 });
  assert.equal(canvas.workflow?.nodes[0].width, undefined);
  assert.equal(canvas.workflow?.nodes[0].height, undefined);
});

test('localStorage restoration path runs persisted canvas geometry sanitizer', () => {
  const storage = new MemoryStorage();
  storage.setItem('kk_test_canvas_state', JSON.stringify({
    canvases: [
      {
        id: 'canvas-1',
        name: 'Persisted broken canvas',
        lastModified: 1,
        promptNodes: [
          {
            id: 'prompt-1',
            prompt: 'prompt',
            position: { x: Number.NaN, y: 900000 },
            height: 9,
            width: 14,
            childImageIds: [],
            timestamp: 1,
          },
        ],
        imageNodes: [],
        groups: [],
        drawings: [],
      },
    ],
    history: { stale: true },
    fileSystemHandle: null,
    folderName: 'folder',
  }));

  withLocalStorage(storage, () => {
    const restored = restoreCanvasStateFromLocalStorage('kk_test_canvas_state');

    assert.equal(restored?.canvases.length, 1);
    assert.deepEqual(restored?.canvases[0].promptNodes[0].position, { x: 0, y: 0 });
    assert.equal(restored?.canvases[0].promptNodes[0].height, undefined);
    assert.equal(restored?.canvases[0].promptNodes[0].width, undefined);
    assert.deepEqual(restored?.history, { stale: true });
  });
});

test('persisted canvas sanitizer tolerates malformed canvas collections', () => {
  assert.deepEqual(sanitizePersistedCanvases(null), []);
  assert.deepEqual(sanitizePersistedCanvases({ canvases: [] }), []);
});

test('canvas view restore rejects thumbnail-scale persisted views', () => {
  const source = readFileSync(path.join(ROOT_DIR, 'src/components/canvas/InfiniteCanvas.tsx'), 'utf-8');

  assert.match(source, /const MIN_RESTORED_CANVAS_VIEW_SCALE = 0\.35;/);
  assert.match(source, /scale >= MIN_RESTORED_CANVAS_VIEW_SCALE/);
});
