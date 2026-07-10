import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreCanvasStateFromLocalStorage } from '../../apps/web/src/context/canvasPersistence.ts';
import { sanitizePersistedCanvases } from '../../apps/web/src/context/canvasGeometrySanitizer.ts';
import {
  getCanvasMigrationBackupKey,
  getCanvasMigrationSummaryKey,
  inferPromptLayoutMode,
  migrateCanvasPresentations,
  restoreCanvasMigrationBackup,
} from '../../apps/web/src/context/canvasPresentationMigration.ts';
import {
  createCanvasFitTransform,
  doesViewportIntersectScene,
  getCanvasViewportStorageKey,
  isValidCanvasViewportTransform,
} from '../../apps/web/src/canvas/canvasViewportPersistence.ts';
import {
  convertCanvasDrawingsToNote,
  restoreCanvasNoteToDrawings,
} from '../../apps/web/src/context/canvasNotes.ts';
import { getCanvasSceneBoundsForNodeIds, unionCanvasSceneBounds } from '../../apps/web/src/canvas/canvasSceneGeometry.ts';

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

test('legacy prompt layout is inferred independently from child geometry', () => {
  const prompt = { id: 'prompt', position: { x: 0, y: 0 } } as any;
  const image = (id: string, x: number, y: number) => ({ id, position: { x, y } }) as any;

  assert.equal(inferPromptLayoutMode(prompt, [image('row', 520, 40)]), 'row');
  assert.equal(inferPromptLayoutMode(prompt, [image('column', 20, 520)]), 'column');
  assert.equal(inferPromptLayoutMode(prompt, [
    image('grid-1', 0, 400),
    image('grid-2', 420, 400),
    image('grid-3', 0, 760),
  ]), 'grid');
});

test('presentation migration keeps every legacy card visible and versions the canvas', () => {
  const migration = migrateCanvasPresentations([{
    id: 'canvas-1',
    name: 'Legacy',
    lastModified: 1,
    promptNodes: [{
      id: 'prompt-1',
      prompt: 'legacy prompt',
      position: { x: 0, y: 0 },
      childImageIds: ['image-1'],
      timestamp: 1,
    }],
    imageNodes: [{
      id: 'image-1',
      url: '',
      prompt: 'result',
      timestamp: 1,
      canvasId: 'canvas-1',
      parentPromptId: 'prompt-1',
      position: { x: 520, y: 0 },
    }],
    groups: [],
    drawings: [],
  }] as any);

  assert.equal(migration.changed, true);
  assert.equal(migration.canvases[0].presentationVersion, 2);
  assert.equal(migration.canvases[0].promptNodes[0].presentation?.kind, 'prompt-result-group');
  assert.equal(migration.canvases[0].promptNodes[0].presentation?.layoutMode, 'row');
  assert.equal(migration.canvases[0].imageNodes[0].presentation?.kind, 'media-only');
});

test('first migration stores a versioned backup and exposes a reversible restore', () => {
  const storageKey = 'kk_test_canvas_migration';
  const storage = new MemoryStorage();
  const original = JSON.stringify({
    canvases: [{
      id: 'canvas-1',
      name: 'Legacy',
      lastModified: 1,
      promptNodes: [],
      imageNodes: [],
      groups: [],
      drawings: [],
    }],
    history: {},
    fileSystemHandle: null,
    folderName: null,
  });
  storage.setItem(storageKey, original);

  withLocalStorage(storage, () => {
    const restored = restoreCanvasStateFromLocalStorage(storageKey);
    assert.equal(restored?.canvases[0].presentationVersion, 2);
    assert.equal(storage.getItem(getCanvasMigrationBackupKey(storageKey)), original);
    assert.ok(storage.getItem(getCanvasMigrationSummaryKey(storageKey)));

    storage.setItem(storageKey, JSON.stringify({ canvases: [] }));
    assert.equal(restoreCanvasMigrationBackup(storageKey), true);
    assert.equal(storage.getItem(storageKey), original);
    assert.equal(storage.getItem(getCanvasMigrationBackupKey(storageKey)), null);
  });
});

test('canvas viewport is scoped, supports the full zoom range, and rejects off-scene views', () => {
  const scene = [{ x: 100, y: 200, width: 320, height: 240 }];
  assert.equal(getCanvasViewportStorageKey('canvas-1', 'desktop'), 'kk_canvas_view:canvas-1:desktop');
  assert.equal(isValidCanvasViewportTransform({ x: 0, y: 0, scale: 0.1 }), true);
  assert.equal(isValidCanvasViewportTransform({ x: 0, y: 0, scale: 3 }), true);
  assert.equal(isValidCanvasViewportTransform({ x: 0, y: 0, scale: 0.09 }), false);
  assert.equal(doesViewportIntersectScene({ x: -100, y: -200, scale: 1 }, { width: 800, height: 600 }, scene), true);
  assert.equal(doesViewportIntersectScene({ x: -10000, y: -10000, scale: 1 }, { width: 800, height: 600 }, scene), false);
});

test('fit transform uses exact scene bounds and centers the result', () => {
  const fitted = createCanvasFitTransform(
    [{ x: 100, y: 200, width: 400, height: 200 }],
    { width: 1000, height: 800 },
    { padding: 100 },
  );
  assert.ok(fitted);
  assert.equal(fitted.scale, 1);
  assert.equal(fitted.x, 200);
  assert.equal(fitted.y, 100);
});

test('selection bounds include child cards when only the prompt root is selected', () => {
  const bounds = getCanvasSceneBoundsForNodeIds({
    id: 'canvas-1',
    name: 'Selection bounds',
    promptNodes: [{
      id: 'prompt-1',
      prompt: 'root',
      position: { x: 0, y: 200 },
      height: 200,
      childImageIds: ['image-1'],
      timestamp: 1,
    }],
    imageNodes: [{
      id: 'image-1',
      url: 'blob:image',
      prompt: '',
      position: { x: 500, y: 600 },
      parentPromptId: 'prompt-1',
      aspectRatio: '1:1',
      timestamp: 1,
    }],
    groups: [],
    drawings: [],
    lastModified: 1,
  } as any, ['prompt-1']);

  assert.equal(bounds.length, 2);
  assert.equal((unionCanvasSceneBounds(bounds)?.x || 0) < 0, true);
  assert.equal((unionCanvasSceneBounds(bounds)?.width || 0) > 600, true);
});

test('drawing conversion moves vectors into an editable notebook card', () => {
  const source = {
    id: 'canvas-1',
    name: 'Notes',
    promptNodes: [],
    imageNodes: [],
    groups: [],
    drawings: [{
      id: 'drawing-1',
      type: 'line',
      points: [{ x: 100, y: 120 }, { x: 200, y: 220 }],
      color: '#fff',
      width: 4,
      bindingNodeId: 'image-1',
    }],
    lastModified: 1,
  } as any;

  const converted = convertCanvasDrawingsToNote(source, ['drawing-1'], {
    id: 'note-1',
    title: 'Review',
    now: 10,
  });
  assert.equal(converted.drawings.length, 0);
  assert.equal(converted.noteNodes?.length, 1);
  assert.equal(converted.noteNodes?.[0].presentation.kind, 'notebook');
  assert.deepEqual(converted.noteNodes?.[0].sourceNodeIds, ['image-1']);
  assert.notDeepEqual(converted.noteNodes?.[0].elements[0].points, source.drawings[0].points);
  assert.equal(source.drawings.length, 1);

  const restored = restoreCanvasNoteToDrawings(converted, 'note-1', { now: 20 });
  assert.equal(restored.noteNodes?.length, 0);
  assert.deepEqual(restored.drawings[0].points, source.drawings[0].points);
  assert.equal(restored.drawings[0].bindingNodeId, 'image-1');
  assert.equal(restored.lastModified, 20);
});
