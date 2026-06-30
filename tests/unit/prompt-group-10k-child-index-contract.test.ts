import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { GenerationMode, type GeneratedImage, type PromptNode } from '../../apps/web/src/types.ts';
import { buildPromptChildImagesByPromptId } from '../../apps/web/src/app/promptGroupChildImages.ts';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function promptNode(input: Partial<PromptNode> & { id: string }): PromptNode {
  return {
    id: input.id,
    prompt: input.prompt ?? input.id,
    position: input.position ?? { x: 0, y: 0 },
    timestamp: input.timestamp ?? 1,
    mode: input.mode ?? GenerationMode.IMAGE,
    childImageIds: input.childImageIds ?? [],
    sourceImageId: input.sourceImageId,
    error: input.error,
  } as PromptNode;
}

function imageNode(input: Partial<GeneratedImage> & { id: string }): GeneratedImage {
  return {
    id: input.id,
    prompt: input.prompt ?? input.id,
    url: input.url ?? `data:image/png;base64,${input.id}`,
    position: input.position ?? { x: 0, y: 0 },
    timestamp: input.timestamp ?? 1,
    parentPromptId: input.parentPromptId ?? '',
    aspectRatio: input.aspectRatio ?? '1:1',
  } as GeneratedImage;
}

test('prompt-group child image lookup preserves ordering and legacy fallback without per-prompt image scans', () => {
  const prompts = [
    promptNode({
      id: 'prompt-strong',
      childImageIds: ['owned-2', 'missing', 'owned-1', 'owned-2', 'source-1'],
      sourceImageId: 'source-1',
    }),
    promptNode({
      id: 'prompt-legacy',
      childImageIds: ['legacy-2', 'legacy-1', 'foreign', 'missing', 'legacy-2'],
    }),
    promptNode({
      id: 'prompt-error',
      childImageIds: ['legacy-1'],
      error: 'failed',
    }),
    promptNode({
      id: 'prompt-ppt',
      mode: GenerationMode.PPT,
      childImageIds: ['ppt-image'],
    }),
  ];

  const images = [
    imageNode({ id: 'owned-1', parentPromptId: 'prompt-strong' }),
    imageNode({ id: 'owned-2', parentPromptId: 'prompt-strong' }),
    imageNode({ id: 'owned-3', parentPromptId: 'prompt-strong' }),
    imageNode({ id: 'source-1', parentPromptId: 'prompt-strong' }),
    imageNode({ id: 'legacy-1' }),
    imageNode({ id: 'legacy-2' }),
    imageNode({ id: 'foreign', parentPromptId: 'other-prompt' }),
    imageNode({ id: 'ppt-image', parentPromptId: 'prompt-ppt' }),
  ];

  const lookup = buildPromptChildImagesByPromptId(prompts, images);

  assert.deepEqual(lookup.get('prompt-strong')?.map((image) => image.id), ['owned-2', 'owned-1', 'owned-3']);
  assert.deepEqual(lookup.get('prompt-legacy')?.map((image) => image.id), ['legacy-2', 'legacy-1']);
  assert.equal(lookup.has('prompt-error'), false);
  assert.equal(lookup.has('prompt-ppt'), false);
});

test('prompt-group child image lookup handles 10000 canvas nodes within a bounded single pass', () => {
  const prompts: PromptNode[] = [];
  const images: GeneratedImage[] = [];

  for (let i = 0; i < 2500; i += 1) {
    const promptId = `prompt-${i}`;
    const childA = `image-${i}-a`;
    const childB = `image-${i}-b`;
    prompts.push(promptNode({
      id: promptId,
      childImageIds: [childB, childA],
      timestamp: i,
      position: { x: (i % 50) * 900, y: Math.floor(i / 50) * 1500 },
    }));
    images.push(
      imageNode({ id: childA, parentPromptId: promptId, timestamp: i * 2 }),
      imageNode({ id: childB, parentPromptId: promptId, timestamp: i * 2 + 1 }),
      imageNode({ id: `standalone-${i}-a`, timestamp: i * 2 + 2 }),
      imageNode({ id: `standalone-${i}-b`, timestamp: i * 2 + 3 }),
    );
  }

  const startedAt = performance.now();
  const lookup = buildPromptChildImagesByPromptId(prompts, images);
  const durationMs = performance.now() - startedAt;

  assert.equal(prompts.length + images.length, 12500);
  assert.equal(lookup.size, prompts.length);
  assert.deepEqual(lookup.get('prompt-2499')?.map((image) => image.id), ['image-2499-b', 'image-2499-a']);
  assert.ok(
    durationMs < 30,
    `Expected one-pass child lookup to stay bounded for 10000+ nodes, got ${durationMs.toFixed(2)}ms`,
  );
});

test('usePromptGroupLayout builds prompt children through the indexed lookup instead of nested scans', () => {
  const source = readSource('apps/web/src/app/usePromptGroupLayout.ts');
  const childMemoStart = source.indexOf('const actualChildImagesByPromptId = useMemo(() => {');
  const childMemoEnd = source.indexOf('const actualChildImageIdsByPromptId = useMemo', childMemoStart);

  assert.notEqual(childMemoStart, -1);
  assert.notEqual(childMemoEnd, -1);

  const childMemoSource = source.slice(childMemoStart, childMemoEnd);
  assert.match(childMemoSource, /buildPromptChildImagesByPromptId\(/);
  assert.doesNotMatch(childMemoSource, /resolveCurrentPromptChildImages\(promptNode,\s*activeCanvas\.imageNodes\)/);
  assert.doesNotMatch(childMemoSource, /activeCanvas\.promptNodes\.forEach\(\(promptNode\) => \{[\s\S]*activeCanvas\.imageNodes/s);
});

test('usePromptGroupLayout builds live-scene snapshots from visible prompt-group views during interaction', () => {
  const source = readSource('apps/web/src/app/usePromptGroupLayout.ts');
  const liveSceneStart = source.indexOf('const liveSceneState = useMemo<LiveSceneSnapshot>(() => {');
  const liveSceneEnd = source.indexOf('const liveSceneRef = useRef(liveSceneState);', liveSceneStart);

  assert.notEqual(liveSceneStart, -1);
  assert.notEqual(liveSceneEnd, -1);

  const liveSceneSource = source.slice(liveSceneStart, liveSceneEnd);
  assert.match(liveSceneSource, /visiblePromptGroupViews\.forEach\(\(groupView\) => \{/);
  assert.doesNotMatch(liveSceneSource, /activeCanvas\.promptNodes\.forEach/);
});

test('usePromptGroupLayout skips full prompt overlap scans for idle large canvases', () => {
  const source = readSource('apps/web/src/app/usePromptGroupLayout.ts');
  const overlapStart = source.indexOf('const computedGroupOverlapMap = useMemo(() => {');
  const overlapEnd = source.indexOf('useEffect(() => {', overlapStart);

  assert.notEqual(overlapStart, -1);
  assert.notEqual(overlapEnd, -1);

  const overlapSource = source.slice(overlapStart, overlapEnd);
  assert.match(source, /const PROMPT_GROUP_OVERLAP_LARGE_CANVAS_THRESHOLD = 500;/);
  assert.match(overlapSource, /promptGroupBoundsById\.size > PROMPT_GROUP_OVERLAP_LARGE_CANVAS_THRESHOLD/);
  assert.match(overlapSource, /&& !focusedGroupId/);
  assert.match(overlapSource, /&& currentGeneratingGroupIds\.length === 0/);
  assert.match(overlapSource, /return currentGroupOverlapMap;/);
  assert.match(overlapSource, /return buildPromptGroupOverlapMap\(promptGroupBoundsById\);/);
});

test('WorkspacePage derives generating prompt groups from indexed child lookup', () => {
  const source = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const generatingStart = source.indexOf('const generatingGroupStateSignatureRef = useRef');
  const generatingEnd = source.indexOf('const maxPersistedCanvasLayer = React.useMemo', generatingStart);

  assert.notEqual(generatingStart, -1);
  assert.notEqual(generatingEnd, -1);

  const generatingSource = source.slice(generatingStart, generatingEnd);
  assert.match(source, /buildPromptChildImagesByPromptId/);
  assert.match(generatingSource, /generatingChildImagesByPromptId\.get\(promptNode\.id\)/);
  assert.doesNotMatch(generatingSource, /resolveCurrentPromptChildImages\(promptNode,\s*activeCanvas\.imageNodes\)/);
});
