import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readSource } from '../support/workspacePaths.js';

const root = process.cwd();

test('AI control execution has one production path through AgentRuntime and runtime ToolRegistry', () => {
  assert.equal(
    fs.existsSync(path.join(root, 'apps/web/src/features/ai-takeover/core/actionExecutor.ts')),
    false,
    'legacy actionExecutor.ts should not remain as a second AI execution path'
  );

  assert.equal(
    fs.existsSync(path.join(root, 'apps/web/src/features/ai-takeover/core/toolRegistry.ts')),
    false,
    'legacy ai-takeover/core/toolRegistry.ts wrapper should not remain as a second ToolRegistry entry'
  );

  const takeoverContext = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
  assert.match(takeoverContext, /agentRuntimeInstance\.executePendingRun/);
  assert.doesNotMatch(takeoverContext, /executeAction/);

  const toolRegistryDoc = readSource('docs/ai-assistant/tool-registry.md');
  const moduleMap = readSource('docs/ai-assistant/module-map.md');
  const flowMap = readSource('docs/ai-assistant/flow-map.md');
  const combinedDocs = `${toolRegistryDoc}\n${moduleMap}\n${flowMap}`;

  assert.match(combinedDocs, /apps\/web\/src\/features\/ai-assistant-runtime\/tools\/ToolRegistry\.ts/);
  assert.doesNotMatch(combinedDocs, /apps\/web\/src\/features\/ai-takeover\/core\/toolRegistry\.ts/);
  assert.doesNotMatch(combinedDocs, /apps\/web\/src\/features\/ai-takeover\/core\/actionExecutor\.ts/);
});
