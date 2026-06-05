import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMentionText,
  createFavoriteImageFromGeneratedImage,
  filterFavorites,
  resolveFavoriteImageSource,
  upsertFavoriteItem,
} from '../../apps/web/src/features/favorites/favoriteUtils.ts';
import {
  appendReferenceMappingToPrompt,
  parseReferenceMentions,
  reorderReferenceImagesByMentions,
} from '../../apps/web/src/features/favorites/mentionParser.ts';
import { ComposerRegistry } from '../../apps/web/src/features/favorites/composerRegistry.ts';
import {
  buildReferenceMentionTabs,
  canCandidateAttachToPromptBar,
} from '../../apps/web/src/features/favorites/referenceSources.ts';
import type { FavoriteImage, ReferenceMentionBuildInput } from '../../apps/web/src/features/favorites/types.ts';

function createImage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'image-1',
    storageId: 'storage-1',
    url: 'https://cdn.example.com/preview.png',
    originalUrl: 'https://cdn.example.com/original.png',
    apiResultUrl: 'https://cdn.example.com/api.png',
    prompt: 'living room',
    aspectRatio: '1:1',
    timestamp: 1,
    model: 'test-model',
    canvasId: 'canvas-1',
    parentPromptId: 'prompt-1',
    position: { x: 0, y: 0 },
    tags: ['interior'],
    ...overrides,
  } as any;
}

test('favorites utilities upsert duplicate image favorites and search them', () => {
  const first = createFavoriteImageFromGeneratedImage(createImage({ alias: 'Living Room' }), 100);
  const duplicate = {
    ...createFavoriteImageFromGeneratedImage(createImage({ alias: 'Room Layout' }), 200),
    storageId: first.storageId,
  };

  const inserted = upsertFavoriteItem([], first);
  const updated = upsertFavoriteItem(inserted, duplicate);

  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, first.id);
  assert.equal(updated[0].name, 'Room Layout');
  assert.equal(updated[0].createdAt, 100);
  assert.equal(updated[0].updatedAt, 200);
  assert.equal(filterFavorites(updated, 'layout', 'images').length, 1);
});

test('favorite image source priority uses original, api result, preview url, then storage id', () => {
  assert.deepEqual(resolveFavoriteImageSource(createImage()), {
    sourceKind: 'originalUrl',
    source: 'https://cdn.example.com/original.png',
  });
  assert.deepEqual(resolveFavoriteImageSource(createImage({ originalUrl: undefined })), {
    sourceKind: 'apiResultUrl',
    source: 'https://cdn.example.com/api.png',
  });
  assert.deepEqual(resolveFavoriteImageSource(createImage({ originalUrl: undefined, apiResultUrl: undefined })), {
    sourceKind: 'url',
    source: 'https://cdn.example.com/preview.png',
  });
  assert.deepEqual(resolveFavoriteImageSource(createImage({ originalUrl: undefined, apiResultUrl: undefined, url: '' })), {
    sourceKind: 'storageId',
    storageId: 'storage-1',
  });
});

test('@ reference parser preserves mention order, dimension, dedupe, and mapping summary', () => {
  const prompt = 'scene @living-room, face @girl[face], again @living-room';
  const mentions = parseReferenceMentions(prompt);

  assert.equal(mentions.length, 3);
  assert.equal(mentions[1].name, 'girl');
  assert.equal(mentions[1].dimension, 'face');

  const result = reorderReferenceImagesByMentions({
    prompt,
    referenceImages: [
      { id: 'ref-girl', data: '', mimeType: 'image/png', mentionName: 'girl' },
      { id: 'ref-room', data: '', mimeType: 'image/png', mentionName: 'living-room' },
      { id: 'ref-extra', data: '', mimeType: 'image/png', mentionName: 'extra' },
    ],
    resolveNameForReference: (reference) => reference.mentionName,
  });

  assert.deepEqual(result.orderedReferenceImages.map((item) => item.id), ['ref-room', 'ref-girl', 'ref-extra']);
  assert.match(result.mappingSummary, /@living-room = reference image 1/);
  assert.match(result.mappingSummary, /@girl\[face\] = reference image 2/);
  assert.equal(appendReferenceMappingToPrompt(prompt, result.mappingSummary).includes('Reference mapping:'), true);
});

test('composer registry inserts into focused composer and falls back to promptbar', () => {
  const registry = new ComposerRegistry();
  const inserted: string[] = [];

  registry.register({
    id: 'promptbar',
    label: 'PromptBar',
    insert: (payload) => {
      inserted.push(`promptbar:${payload.text}`);
    },
  });
  registry.register({
    id: 'assistant',
    label: 'Assistant',
    insert: (payload) => {
      inserted.push(`assistant:${payload.text}`);
    },
  });

  assert.equal(registry.insert({ text: 'hello' }), true);
  registry.markFocused('assistant');
  assert.equal(registry.insert({ text: 'world' }), true);

  assert.deepEqual(inserted, ['promptbar:hello', 'assistant:world']);
});

test('reference mention tabs separate uploads, inherited tags, and liked images', () => {
  const favorite: FavoriteImage = {
    id: 'fav-1',
    kind: 'favorite-image',
    name: 'liked-room',
    sourceImageId: 'image-liked',
    storageId: 'liked-storage',
    mimeType: 'image/png',
    url: 'https://cdn.example.com/liked.png',
    createdAt: 1,
    updatedAt: 1,
  };
  const input: ReferenceMentionBuildInput = {
    promptBarReferences: [
      { id: 'uploaded-ref', data: '', mimeType: 'image/png', mentionName: 'uploaded-room' },
    ],
    assistantFiles: [{
      id: 'file-1',
      kind: 'file',
      name: 'brief.pdf',
      mimeType: 'application/pdf',
      size: 10,
      uploadState: 'linked',
      sensitive: false,
    }],
    promptNodes: [{
      id: 'prompt-1',
      prompt: 'tag source',
      tags: ['scene-layout'],
      childImageIds: ['image-1'],
    } as any],
    imageNodes: [createImage({ id: 'image-1', tags: [] })],
    favorites: [favorite],
  };

  const tabs = buildReferenceMentionTabs(input);
  const uploadTab = tabs.find((tab) => tab.id === 'upload');
  const tagTab = tabs.find((tab) => tab.id === 'tag');
  const favoriteTab = tabs.find((tab) => tab.id === 'favorite');

  assert.deepEqual(tabs.map((tab) => tab.label), ['上传内容', '标签', '喜欢']);
  assert.equal(uploadTab?.items.length, 2);
  assert.equal(tagTab?.items.length, 1);
  assert.equal(tagTab?.items[0].name, 'scene-layout');
  assert.equal(favoriteTab?.items[0].mentionText, buildMentionText('liked-room'));
  assert.equal(canCandidateAttachToPromptBar(uploadTab!.items.find((item) => item.kind === 'uploaded-file')!), false);
  assert.equal(canCandidateAttachToPromptBar(favoriteTab!.items[0]), true);
});
