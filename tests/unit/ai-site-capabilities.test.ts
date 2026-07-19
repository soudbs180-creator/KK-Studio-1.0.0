import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGENT_CONTROL_ACTIONS,
  CHAT_SHELL_ACTIONS,
  PROMPT_COMPOSER_ACTIONS,
} from '../../apps/web/src/features/ai-assistant-runtime/index.ts';
import type { AssistantSiteCapabilityPorts } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AssistantExecutionContext.ts';
import {
  AgentToolRegistry,
  toolRegistryInstance,
} from '../../apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts';
import { siteCapabilityTools } from '../../apps/web/src/features/ai-assistant-runtime/tools/siteCapabilityTools.ts';
import { analyzeIntent } from '../../apps/web/src/features/ai-takeover/core/intentGate.ts';
import { LocalAssistantBrain } from '../../apps/web/src/features/ai-takeover/core/localBrain.ts';
import { readSource } from '../support/workspacePaths.js';

const createRegistry = () => {
  const registry = new AgentToolRegistry();
  siteCapabilityTools.forEach((tool) => registry.register(tool));
  return registry;
};

test('AI site domains are registered with explicit risk policies and no billing/account write tools', () => {
  const expectedTools = [
    'navigation.openSurface',
    'navigation.openSettings',
    'workspace.getState',
    'workspace.focus',
    'project.list',
    'project.getActive',
    'project.open',
    'project.create',
    'project.rename',
    'project.delete',
    'canvas.getState',
    'canvas.getSelectedNodes',
    'canvas.arrangeNodes',
    'generation.createBatchJob',
    'generation.getJobStatus',
    'assets.list',
    'assets.zipOriginals',
    'export.getCapabilities',
    'export.zipOriginals',
    'history.getState',
    'history.undo',
    'history.redo',
    'preferences.get',
    'preferences.updateGenerationDefaults',
    'account.getSummary',
    'billing.getSummary',
  ];

  expectedTools.forEach((name) => assert.ok(toolRegistryInstance.getTool(name), `missing domain tool ${name}`));
  assert.equal(toolRegistryInstance.getTool('project.open')?.permission, 'safe');
  assert.equal(toolRegistryInstance.getTool('project.create')?.permission, 'confirm');
  assert.equal(toolRegistryInstance.getTool('project.rename')?.permission, 'safe');
  assert.equal(toolRegistryInstance.getTool('project.delete')?.permission, 'dangerous');
  assert.equal(toolRegistryInstance.getTool('preferences.updateGenerationDefaults')?.permission, 'confirm');
  assert.equal(toolRegistryInstance.getTool('account.getSummary')?.control.effect, 'read');
  assert.equal(toolRegistryInstance.getTool('billing.getSummary')?.control.effect, 'read');
  assert.equal(toolRegistryInstance.getTool('export.zipOriginals')?.permission, 'confirm');

  for (const forbiddenName of [
    'account.update',
    'account.setRole',
    'billing.recharge',
    'billing.approveRecharge',
    'billing.confirmPayment',
    'billing.setBalance',
    'keys.read',
    'keys.write',
    'database.execute',
    'shell.execute',
  ]) {
    assert.equal(toolRegistryInstance.getTool(forbiddenName), undefined, `${forbiddenName} must not exist`);
  }

  for (const tool of siteCapabilityTools.filter((definition) => definition.control?.effect === 'mutation')) {
    assert.ok(tool.inputValidator, `${tool.name} must define a typed input validator`);
    assert.equal(tool.control?.idempotency?.required, true, `${tool.name} must require an idempotency key`);
    assert.ok(tool.verify, `${tool.name} must verify the converged Host state`);
  }
});

test('site tools read live project, selection, asset and history ports after project navigation', async () => {
  let activeProjectId = 'project-a';
  let projectNames = new Map([
    ['project-a', 'Project A'],
    ['project-b', 'Project B'],
  ]);
  let undoCount = 0;
  let redoCount = 0;
  let undoDepth = 2;
  let redoDepth = 1;
  let preferences = { mode: 'image', aspectRatio: '1:1', parallelCount: 2 };

  const projectSnapshot = () => ({
    activeProjectId,
    canCreateProject: true,
    projects: [...projectNames].map(([id, name]) => ({
      id,
      name,
      active: id === activeProjectId,
      lastModified: id === activeProjectId ? 20 : 10,
      promptCount: id === activeProjectId ? 2 : 0,
      imageCount: id === activeProjectId ? 1 : 0,
      noteCount: 0,
      workflowNodeCount: 0,
    })),
  });

  const siteCapabilities: AssistantSiteCapabilityPorts = {
    navigation: {
      openSurface: async () => {},
      openSettings: async () => {},
    },
    project: {
      getSnapshot: projectSnapshot,
      openProject: async (projectId) => { activeProjectId = projectId; },
      createProject: async (name) => {
        projectNames.set('project-c', name || 'Project C');
        activeProjectId = 'project-c';
        return 'project-c';
      },
      renameProject: async (projectId, name) => { projectNames.set(projectId, name); },
      deleteProject: async (projectId) => { projectNames.delete(projectId); },
    },
    history: {
      getSnapshot: () => ({
        projectId: activeProjectId,
        canUndo: undoDepth > 0,
        canRedo: redoDepth > 0,
        undoDepth,
        redoDepth,
      }),
      undo: async () => {
        undoCount += 1;
        undoDepth -= 1;
        redoDepth += 1;
      },
      redo: async () => {
        redoCount += 1;
        undoDepth += 1;
        redoDepth -= 1;
      },
    },
    preferences: {
      getGenerationDefaults: () => preferences,
      updateGenerationDefaults: async (patch) => { preferences = { ...preferences, ...patch }; },
    },
    account: {
      getAccountSummary: () => ({
        ownerId: 'owner-a',
        authenticated: true,
        apiKeyStatus: 'configured_masked',
      }),
      getBillingSummary: () => ({ available: true, balance: 42, unit: 'credits' }),
    },
    assets: {
      getSnapshot: () => ({
        imageCollections: [],
        images: [{ id: 'imported-1', name: 'reference.png', collectionId: 'assets_pool', uploadState: 'local_ready' }],
        files: [],
        outputs: [],
      }),
    },
  };

  const activeCanvasByProject: Record<string, any> = {
    'project-a': { id: 'project-a', lastModified: 20, imageNodes: [{ id: 'output-a', name: 'A', originalUrl: 'local:a' }] },
    'project-b': { id: 'project-b', lastModified: 30, imageNodes: [{ id: 'output-b', name: 'B', storageId: 'storage-b' }] },
  };
  const ctx: any = {
    currentPage: 'canvas',
    collaborationMode: 'takeover',
    siteCapabilities,
    getActiveCanvas: () => activeCanvasByProject[activeProjectId],
    getSelectedNodeIds: () => activeProjectId === 'project-b' ? ['output-b'] : ['output-a'],
    getCanvasRuntimeState: () => ({
      canvas: { id: activeProjectId },
      selection: { selectedNodeIds: activeProjectId === 'project-b' ? ['output-b'] : ['output-a'] },
    }),
    generationQueue: { getJobs: () => [] },
  };
  const registry = createRegistry();

  const before = await registry.execute('project.getActive', {}, ctx);
  assert.equal(before.id, 'project-a');

  await registry.execute('project.open', { projectId: 'project-b' }, ctx);
  const workspace = await registry.execute('workspace.getState', {}, ctx);
  assert.equal(workspace.project.activeProjectId, 'project-b');
  assert.deepEqual(workspace.selection.selectedNodeIds, ['output-b']);

  const assets = await registry.execute('assets.list', { scope: 'selection' }, ctx);
  assert.equal(assets.canvas.length, 1);
  assert.equal(assets.canvas[0].id, 'output-b');
  assert.equal(assets.canvas[0].hasOriginal, true);
  assert.equal(assets.imported, undefined);

  await registry.execute('project.rename', {
    projectId: 'project-b',
    name: 'Renamed B',
    idempotencyKey: 'rename-project-b',
  }, ctx);
  assert.equal(projectNames.get('project-b'), 'Renamed B');

  await registry.execute('history.undo', { idempotencyKey: 'undo-project-b' }, ctx);
  await registry.execute('history.redo', { idempotencyKey: 'redo-project-b' }, ctx);
  assert.equal(undoCount, 1);
  assert.equal(redoCount, 1);

  assert.deepEqual(await registry.execute('account.getSummary', {}, ctx), {
    ownerId: 'owner-a',
    authenticated: true,
    apiKeyStatus: 'configured_masked',
  });
  assert.deepEqual(await registry.execute('billing.getSummary', {}, ctx), {
    available: true,
    balance: 42,
    unit: 'credits',
  });
});

test('generation preference validator rejects secret and unbounded inputs before host mutation', () => {
  const tool = toolRegistryInstance.getTool('preferences.updateGenerationDefaults');
  assert.ok(tool);

  assert.throws(
    () => tool.inputValidator.parse({ patch: { apiKey: 'secret' }, idempotencyKey: 'preferences-secret' }),
    /Unsupported generation preference: apiKey/,
  );
  assert.throws(
    () => tool.inputValidator.parse({ patch: { parallelCount: 99 }, idempotencyKey: 'preferences-count' }),
    /between 1 and 8/,
  );
  assert.deepEqual(
    tool.inputValidator.parse({ patch: { mode: 'video', parallelCount: 3 }, idempotencyKey: 'preferences-valid' }),
    { patch: { mode: 'video', parallelCount: 3 }, idempotencyKey: 'preferences-valid' },
  );
});

test('project intents list safely, freeze an exact target, and clarify ambiguous names', async () => {
  const projects = {
    activeProjectId: 'project-a',
    items: [
      { id: 'project-a', name: 'Campaign', active: true },
      { id: 'project-b', name: 'Product Launch', active: false },
      { id: 'project-c', name: 'Campaign', active: false },
    ],
  };
  const context = {
    projects,
    settings: { apiKeyStatus: 'configured' },
    canvas: { selectedNodeIds: [] },
    assets: { images: [] },
  } as any;

  const listIntent = analyzeIntent('list projects', context);
  assert.equal(listIntent.intent, 'list_projects');
  assert.equal(listIntent.needsConfirmation, false);

  const exactIntent = analyzeIntent('open project Product Launch', context);
  assert.equal(exactIntent.intent, 'open_project');
  assert.equal(exactIntent.extracted.projectId, 'project-b');
  assert.equal(exactIntent.extracted.projectName, 'Product Launch');

  const projectManagerIntent = analyzeIntent('open project manager', context);
  assert.equal(projectManagerIntent.intent, 'open_settings_view');
  assert.equal(projectManagerIntent.extracted.settingsView, 'project-manager');

  const ambiguousIntent = analyzeIntent('open project Campaign', context);
  assert.equal(ambiguousIntent.intent, 'open_project');
  assert.equal(ambiguousIntent.extracted.projectId, undefined);

  const plan = await new LocalAssistantBrain().plan('open project Campaign', context);
  assert.equal(plan.intent, 'open_project');
  assert.deepEqual(plan.actions, []);
  assert.match(plan.reply, /需要确认要打开的项目/);
});

test('pure UI catalogs remain local while business submission and durable job controls use domain tools', () => {
  assert.ok(Object.values(CHAT_SHELL_ACTIONS).every((action) => action.toolName === undefined));
  assert.equal(PROMPT_COMPOSER_ACTIONS.toggleAdvancedOptions.toolName, undefined);
  assert.equal(PROMPT_COMPOSER_ACTIONS.toggleParallelCountMenu.toolName, undefined);
  assert.equal(PROMPT_COMPOSER_ACTIONS.submitGeneration.toolName, 'generation.submitComposer');
  assert.equal(AGENT_CONTROL_ACTIONS.toggleTakeoverResources.toolName, undefined);
  assert.equal(AGENT_CONTROL_ACTIONS.toggleTakeoverHistory.toolName, undefined);
  assert.equal(AGENT_CONTROL_ACTIONS.pauseGenerationJob.toolName, 'generation.pauseJob');
  assert.equal(AGENT_CONTROL_ACTIONS.retryGenerationJob.toolName, 'generation.retryJob');
});

test('planner and host wiring encode the canonical project-to-ZIP journey without selector execution', () => {
  const llmBrain = readSource('apps/web/src/features/ai-takeover/core/llmBrain.ts');
  const localBrain = readSource('apps/web/src/features/ai-takeover/core/localBrain.ts');
  const takeoverContext = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
  const chatSidebar = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  for (const toolName of [
    'project.open',
    'assets.list',
    'canvas.getSelectedNodes',
    'generation.createBatchJob',
    'generation.getJobStatus',
    'assets.zipOriginals',
  ]) {
    assert.match(llmBrain, new RegExp(toolName.replace('.', '\\.')));
  }
  assert.match(takeoverContext, /generationQueue:\s*durableGenerationQueue/);
  assert.match(takeoverContext, /durableGenerationQueue\.registerExecutor/);
  assert.match(takeoverContext, /durableGenerationQueue\.registerArrangeHandler/);
  assert.match(chatSidebar, /siteCapabilities=\{siteCapabilities\}/);
  assert.match(chatSidebar, /canvasStateRef\.current/);
  assert.doesNotMatch(localBrain, /payload:\s*\{\s*selector:/);
  assert.doesNotMatch(localBrain, /type:\s*'highlightElement'/);
  assert.doesNotMatch(localBrain, /type:\s*'zipOutputs'/);
  assert.doesNotMatch(localBrain, /type:\s*'startGeneration'/);
  assert.doesNotMatch(localBrain, /type:\s*'startBatchGeneration'/);
  assert.doesNotMatch(localBrain, /type:\s*'generation\.start'/);
  assert.doesNotMatch(localBrain, /type:\s*'generation\.submitComposer'/);
  assert.doesNotMatch(localBrain, /type:\s*'ui\.navigateToSurface'/);
  assert.doesNotMatch(localBrain, /type:\s*'ui\.openSettings'/);
  assert.doesNotMatch(localBrain, /type:\s*'openSettings'/);
});
