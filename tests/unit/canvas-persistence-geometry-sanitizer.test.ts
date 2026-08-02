import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCanvasRecoveryDiagnosticKey,
  readCanvasMigrationSummary,
  restoreCanvasStateFromLocalStorage,
} from '../../apps/web/src/context/canvasPersistence.ts';
import {
  sanitizePersistedCanvases,
  sanitizePersistedCanvasesWithReport,
} from '../../apps/web/src/context/canvasGeometrySanitizer.ts';
import {
  acceptCanvasMigration,
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

class QuotaBackupStorage extends MemoryStorage {
  override setItem(key: string, value: string): void {
    if (key.includes(':backup')) {
      const error = new Error('Storage quota exceeded');
      error.name = 'QuotaExceededError';
      throw error;
    }
    super.setItem(key, value);
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

test('persisted canvas sanitizer salvages valid canvases beside malformed entries', () => {
  const result = sanitizePersistedCanvasesWithReport([
    null,
    {
      id: 'canvas-valid',
      name: 'Valid',
      lastModified: 1,
      promptNodes: [],
      imageNodes: [],
      groups: [],
      drawings: [],
    },
  ]);

  assert.deepEqual(result.canvases.map((canvas) => canvas.id), ['canvas-valid']);
  assert.equal(result.changed, true);
  assert.equal(result.issues.some((issue) => issue.code === 'invalid-canvas-entry'), true);
});

test('persisted canvas sanitizer isolates malformed workflow edges without throwing', () => {
  const result = sanitizePersistedCanvasesWithReport([{
    id: 'canvas-workflow',
    name: 'Workflow',
    lastModified: 1,
    promptNodes: [],
    imageNodes: [],
    groups: [],
    drawings: [],
    workflow: { version: 1, nodes: [], edges: [null] },
  }]);

  assert.deepEqual(result.canvases[0].workflow?.edges, []);
  assert.equal(result.issues.some((issue) => issue.code === 'invalid-workflow-edge-entry'), true);
});

test('corrupt JSON remains untouched and receives a recovery diagnostic', () => {
  const storageKey = 'kk_test_corrupt_canvas_state';
  const storage = new MemoryStorage();
  storage.setItem(storageKey, '{not-json');

  withLocalStorage(storage, () => {
    assert.equal(restoreCanvasStateFromLocalStorage(storageKey), null);
    assert.equal(storage.getItem(storageKey), '{not-json');
    const diagnostic = JSON.parse(storage.getItem(getCanvasRecoveryDiagnosticKey(storageKey)) || '{}');
    assert.equal(diagnostic.code, 'canvas-restore-failed');
    assert.equal(diagnostic.sourceLength, 9);
  });
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

test('versioned canvases still migrate missing notebook presentations', () => {
  const migration = migrateCanvasPresentations([{
    id: 'canvas-1',
    name: 'Versioned but incomplete',
    presentationVersion: 2,
    lastModified: 1,
    promptNodes: [],
    imageNodes: [],
    groups: [],
    drawings: [],
    noteNodes: [{
      id: 'note-1',
      title: 'Legacy note',
      position: { x: 0, y: 0 },
      width: 320,
      height: 240,
      elements: [],
      createdAt: 1,
      updatedAt: 1,
    }],
  }] as any);

  assert.equal(migration.changed, true);
  assert.equal(migration.canvases[0].noteNodes?.[0].presentation.kind, 'notebook');
  assert.equal(migration.summary.repairedNodeIds.includes('note-1'), true);
});

test('damaged versioned presentations become visible diagnostic cards', () => {
  const migration = migrateCanvasPresentations([{
    id: 'canvas-1',
    name: 'Damaged',
    presentationVersion: 2,
    lastModified: 1,
    promptNodes: [{
      id: 'prompt-1',
      prompt: 'keep me',
      position: { x: 0, y: 0 },
      childImageIds: [],
      timestamp: 1,
      presentation: {
        version: 2,
        kind: 'not-a-card-kind',
        layoutMode: 'row',
        size: 'standard',
        ports: { source: 'right', target: 'left' },
      },
    }],
    imageNodes: [],
    groups: [],
    drawings: [],
  }] as any);

  const presentation = migration.canvases[0].promptNodes[0].presentation;
  assert.equal(presentation?.kind, 'unknown');
  assert.match(presentation?.diagnostic || '', /Damaged card presentation/);
  assert.equal(migration.summary.flaggedNodeIds?.includes('prompt-1'), true);
});

test('sanitizer-only repairs create a backup and migration summary', () => {
  const storageKey = 'kk_test_canvas_sanitizer_backup';
  const storage = new MemoryStorage();
  const original = JSON.stringify({
    canvases: [{
      id: 'canvas-1',
      name: 'Already versioned',
      presentationVersion: 2,
      lastModified: 1,
      promptNodes: [],
      imageNodes: [{
        id: 'image-1',
        url: '',
        prompt: '',
        timestamp: 1,
        canvasId: 'canvas-1',
        parentPromptId: 'missing',
        position: { x: 0, y: 0 },
        presentation: {
          version: 2,
          kind: 'media-only',
          layoutMode: 'column',
          size: 'compact',
          ports: { source: 'bottom', target: 'top' },
        },
      }],
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
    assert.equal(restored?.canvases[0].imageNodes[0].orphaned, true);
    assert.equal(storage.getItem(getCanvasMigrationBackupKey(storageKey)), original);
    const summary = JSON.parse(storage.getItem(getCanvasMigrationSummaryKey(storageKey)) || '{}');
    assert.equal(summary.repairedNodeIds.includes('image-1'), true);
  });
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

test('migration summary survives when the original backup exceeds localStorage quota', () => {
  const storageKey = 'kk_test_canvas_migration_quota';
  const storage = new QuotaBackupStorage();
  const original = JSON.stringify({
    canvases: [{
      id: 'canvas-1',
      name: 'Large legacy canvas',
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
    assert.equal(storage.getItem(getCanvasMigrationBackupKey(storageKey)), null);
    const summary = JSON.parse(storage.getItem(getCanvasMigrationSummaryKey(storageKey)) || '{}');
    assert.equal(summary.backupKey, undefined);
    assert.deepEqual(summary.migratedCanvasIds, ['canvas-1']);
  });
});

test('migration summary can be read and accepted without deleting current canvas data', () => {
  const storageKey = 'kk_test_canvas_migration_accept';
  const storage = new MemoryStorage();
  const current = JSON.stringify({ canvases: [{ id: 'canvas-current' }] });
  storage.setItem(storageKey, current);
  storage.setItem(getCanvasMigrationBackupKey(storageKey), JSON.stringify({ canvases: [] }));
  storage.setItem(getCanvasMigrationSummaryKey(storageKey), JSON.stringify({
    version: 2,
    migratedCanvasIds: ['canvas-current'],
    repairedNodeIds: ['node-1'],
    inferredLayoutNodeIds: [],
    completedAt: 123,
  }));

  withLocalStorage(storage, () => {
    assert.deepEqual(readCanvasMigrationSummary(storageKey)?.repairedNodeIds, ['node-1']);
    acceptCanvasMigration(storageKey);
    assert.equal(storage.getItem(storageKey), current);
    assert.equal(storage.getItem(getCanvasMigrationBackupKey(storageKey)), null);
    assert.equal(readCanvasMigrationSummary(storageKey), null);
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
  assert.equal(doesViewportIntersectScene(
    { x: -900, y: -200, scale: 1 },
    { x: 1000, y: 0, width: 800, height: 600 },
    scene,
  ), false);
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

test('notebook conversion includes long text extents in card bounds', () => {
  const source = {
    id: 'canvas-1',
    name: 'Text note',
    promptNodes: [],
    imageNodes: [],
    groups: [],
    drawings: [{
      id: 'text-1',
      type: 'text',
      points: [{ x: 100, y: 100 }],
      color: '#fff',
      width: 1,
      text: 'This is a long annotation that must remain inside the note card.',
      fontSize: 24,
    }],
    lastModified: 1,
  } as any;

  const converted = convertCanvasDrawingsToNote(source, ['text-1'], { id: 'note-text', now: 1 });
  assert.ok((converted.noteNodes?.[0].width || 0) > 700);
});
