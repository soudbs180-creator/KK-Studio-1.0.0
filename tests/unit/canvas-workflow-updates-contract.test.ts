import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  AspectRatio,
  ImageSize,
  KnownModel,
  type Canvas,
  type PromptNode,
  type WorkflowNode,
} from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();

type CanvasWorkflowUpdatesModule = {
  addCanvasWorkflowNode: (canvas: Canvas, node: WorkflowNode) => Canvas;
  updateCanvasWorkflowNode: (canvas: Canvas, id: string, updates: Partial<WorkflowNode>) => Canvas;
  updateCanvasWorkflowNodePosition: (canvas: Canvas, id: string, position: { x: number; y: number }) => Canvas;
  deleteCanvasWorkflowNode: (canvas: Canvas, id: string) => Canvas;
};



async function loadCanvasWorkflowUpdatesModule(): Promise<CanvasWorkflowUpdatesModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/context/canvasWorkflowUpdates.ts');
  assert.equal(existsSync(fullPath), true, 'src/context/canvasWorkflowUpdates.ts must exist');
  return await import('../../apps/web/src/context/canvasWorkflowUpdates.ts') as CanvasWorkflowUpdatesModule;
}

function promptNode(input: Partial<PromptNode> & Pick<PromptNode, 'id'>): PromptNode {
  return {
    id: input.id,
    prompt: input.prompt ?? input.id,
    position: input.position ?? { x: 0, y: 0 },
    aspectRatio: input.aspectRatio ?? AspectRatio.SQUARE,
    imageSize: input.imageSize ?? ImageSize.SIZE_1K,
    model: input.model ?? KnownModel.IMAGEN_4,
    childImageIds: input.childImageIds ?? [],
    timestamp: input.timestamp ?? 1,
    ...input,
  };
}

function workflowNode(input: Partial<WorkflowNode> & Pick<WorkflowNode, 'id' | 'kind'>): WorkflowNode {
  return {
    id: input.id,
    kind: input.kind,
    position: input.position ?? { x: 0, y: 0 },
    label: input.label ?? input.id,
    data: input.data ?? {},
    ...input,
  } as WorkflowNode;
}

function canvas(input: Partial<Canvas> & Pick<Canvas, 'id'>): Canvas {
  return {
    id: input.id,
    name: input.name ?? input.id,
    promptNodes: input.promptNodes ?? [],
    imageNodes: input.imageNodes ?? [],
    groups: input.groups ?? [],
    drawings: input.drawings ?? [],
    lastModified: input.lastModified ?? 0,
    ...input,
  };
}

test('canvas workflow update boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasWorkflowUpdates.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-workflow-updates-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasWorkflowUpdates';/);
  assert.match(helperSource, /export function addCanvasWorkflowNode/);
  assert.match(helperSource, /export function updateCanvasWorkflowNode/);
  assert.match(helperSource, /export function updateCanvasWorkflowNodePosition/);
  assert.match(helperSource, /export function deleteCanvasWorkflowNode/);

  const workflowWrapperSource = contextSource.slice(
    contextSource.indexOf('const addWorkflowNode = useCallback'),
    contextSource.indexOf('const deleteImageNode = useCallback')
  );
  assert.match(workflowWrapperSource, /addCanvasWorkflowNode\(canvas, node\)/);
  assert.match(workflowWrapperSource, /updateCanvasWorkflowNode\(canvas, id, updates\)/);
  assert.match(workflowWrapperSource, /updateCanvasWorkflowNodePosition\(canvas, id, pos\)/);
  assert.match(workflowWrapperSource, /deleteCanvasWorkflowNode\(canvas, id\)/);
  assert.doesNotMatch(workflowWrapperSource, /dedupeWorkflowEdges/);
  assert.doesNotMatch(workflowWrapperSource, /getWorkflowSourceNodeIds/);
});

test('addCanvasWorkflowNode appends a utility node and creates valid source control edges', async () => {
  const { addCanvasWorkflowNode } = await loadCanvasWorkflowUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1' }), promptNode({ id: 'prompt-2' })],
    workflow: {
      version: 1,
      nodes: [workflowNode({ id: 'save-0', kind: 'save' })],
      edges: [],
    },
    lastModified: 123,
  });
  const saveNode = workflowNode({
    id: 'save-1',
    kind: 'save',
    data: { sourceNodeIds: ['prompt-1', 'missing', 'prompt-1'] },
  });

  const result = addCanvasWorkflowNode(source, saveNode);
  const duplicate = addCanvasWorkflowNode(result, saveNode);

  assert.equal(result.lastModified, source.lastModified);
  assert.equal(result.workflow?.nodes.some((node) => node.id === 'save-1'), true);
  assert.deepEqual(
    result.workflow?.edges.filter((edge) => edge.to === 'save-1').map((edge) => [edge.id, edge.from, edge.to, edge.role]),
    [['edge:prompt-1:control:save-1', 'prompt-1', 'save-1', 'control']]
  );
  assert.equal(duplicate, result);
});

test('updateCanvasWorkflowNode preserves id and kind while rebuilding source edges', async () => {
  const { updateCanvasWorkflowNode } = await loadCanvasWorkflowUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1' }), promptNode({ id: 'prompt-2' })],
    workflow: {
      version: 1,
      nodes: [workflowNode({ id: 'save-1', kind: 'save', data: { sourceNodeIds: ['prompt-1'] } })],
      edges: [
        { id: 'edge:prompt-1:control:save-1', from: 'prompt-1', to: 'save-1', role: 'control' },
        { id: 'edge:missing:control:save-1', from: 'missing', to: 'save-1', role: 'control' },
      ],
    },
  });

  const result = updateCanvasWorkflowNode(source, 'save-1', {
    id: 'mutated-id',
    kind: 'agent',
    label: 'Updated Save',
    data: { sourceNodeIds: ['prompt-2', 'missing'] },
  } as Partial<WorkflowNode>);

  assert.equal(result.workflow?.nodes.find((node) => node.id === 'save-1')?.kind, 'save');
  assert.equal(result.workflow?.nodes.find((node) => node.id === 'save-1')?.label, 'Updated Save');
  assert.deepEqual(
    result.workflow?.edges.filter((edge) => edge.to === 'save-1').map((edge) => [edge.id, edge.from, edge.to, edge.role]),
    [['edge:prompt-2:control:save-1', 'prompt-2', 'save-1', 'control']]
  );
});

test('workflow position and delete helpers update only matching workflow nodes', async () => {
  const {
    deleteCanvasWorkflowNode,
    updateCanvasWorkflowNodePosition,
  } = await loadCanvasWorkflowUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1' })],
    workflow: {
      version: 1,
      nodes: [
        workflowNode({ id: 'save-1', kind: 'save', position: { x: 10, y: 20 } }),
        workflowNode({ id: 'agent-1', kind: 'agent', position: { x: 100, y: 200 } }),
      ],
      edges: [
        { id: 'edge:prompt-1:control:save-1', from: 'prompt-1', to: 'save-1', role: 'control' },
        { id: 'edge:save-1:sequence:agent-1', from: 'save-1', to: 'agent-1', role: 'sequence' },
      ],
    },
  });

  const moved = updateCanvasWorkflowNodePosition(source, 'save-1', { x: 15, y: 25 });
  const missingMove = updateCanvasWorkflowNodePosition(source, 'missing', { x: 1, y: 2 });
  const deleted = deleteCanvasWorkflowNode(moved, 'save-1');
  const missingDelete = deleteCanvasWorkflowNode(source, 'missing');

  assert.deepEqual(moved.workflow?.nodes.find((node) => node.id === 'save-1')?.position, { x: 15, y: 25 });
  assert.deepEqual(moved.workflow?.nodes.find((node) => node.id === 'agent-1')?.position, { x: 100, y: 200 });
  assert.equal(missingMove, source);
  assert.equal(deleted.workflow?.nodes.some((node) => node.id === 'save-1'), false);
  assert.deepEqual(deleted.workflow?.edges, []);
  assert.equal(missingDelete, source);
});
