import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { getWorkflowSourceNodeIds } from '../../src/context/canvasWorkflowSourceNodeIds.ts';
import type { WorkflowNode } from '../../src/types.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

type WorkflowNodeFixture = {
  id: string;
  kind: WorkflowNode['kind'];
  position?: { x: number; y: number };
  data?: unknown;
};

function workflowNode(input: WorkflowNodeFixture): WorkflowNode {
  return {
    id: input.id,
    kind: input.kind,
    position: input.position ?? { x: 0, y: 0 },
    data: input.data ?? {},
  } as WorkflowNode;
}

test('workflow source node id resolver boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasWorkflowSourceNodeIds.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-workflow-source-node-ids-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasWorkflowSourceNodeIds';/);
  assert.match(helperSource, /export function getWorkflowSourceNodeIds/);
  assert.doesNotMatch(contextSource, /const getWorkflowSourceNodeIds =/);
});

test('utility workflow nodes preserve first source id order and filter invalid values', () => {
  const node = workflowNode({
    id: 'save-1',
    kind: 'save',
    data: {
      sourceNodeIds: ['prompt-1', '', 'image-1', 'prompt-1', '   ', 12, null, ' image-2 '],
    },
  });

  assert.deepEqual(getWorkflowSourceNodeIds(node), ['prompt-1', 'image-1', ' image-2 ']);
});

test('non-utility or malformed workflow nodes do not expose source ids', () => {
  assert.deepEqual(getWorkflowSourceNodeIds(workflowNode({
    id: 'prompt-1',
    kind: 'prompt',
    data: { sourceNodeIds: ['image-1'] },
  })), []);

  assert.deepEqual(getWorkflowSourceNodeIds(workflowNode({
    id: 'agent-1',
    kind: 'agent',
    data: { sourceNodeIds: 'image-1' },
  })), []);
});
