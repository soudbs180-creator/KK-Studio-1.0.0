import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type { EcommerceAnalysisResult } from '../../apps/web/src/services/ecommerce/types.ts';
import {
  buildEcommerceAnalysisCounts,
  buildEcommerceAnalysisSuccessPatch,
  buildEcommerceProductImageData,
  buildEcommerceAnalysisSelectedItems,
  createEcommerceAnalysisResetPatch,
  createEmptyEcommerceGroupSlots,
  normalizeEcommerceAnalysisResult,
  runEcommerceRequirementAnalysis,
  type EcommerceRequirementAnalysisRuntimeState,
} from '../../apps/web/src/app/useEcommerceRequirementAnalysisRuntime.ts';
import type { EcommerceEditableTaskState } from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();



function createAnalysis(): EcommerceAnalysisResult {
  return {
    seriesTemplate: {} as EcommerceAnalysisResult['seriesTemplate'],
    projectMeta: {
      projectName: 'project',
      productName: 'product',
      sourceFileName: 'source.xlsx',
      sourceFileType: 'xlsx',
      warnings: [],
    },
    assets: { productAssets: [], referenceAssets: [] },
    mainImageItems: [
      { itemId: 'main-1' },
      { itemId: 'main-2' },
    ] as EcommerceAnalysisResult['mainImageItems'],
    aPlusGroup: {
      groupId: 'aplus',
      title: 'A+',
      modules: [
        { moduleId: 'module-1' },
      ] as EcommerceAnalysisResult['aPlusGroup']['modules'],
      groupWarnings: [],
    },
    reviewWarnings: [],
  };
}

test('ecommerce requirement analysis runtime owns reset, file, and analyze callbacks', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceRequirementAnalysisRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'apps/web/src/app/useEcommerceRequirementAnalysisRuntime.ts should exist');

  const appSource = readSource('apps/web/src/App.tsx');
  const hookSource = readSource('apps/web/src/app/useEcommerceRequirementAnalysisRuntime.ts');

  assert.match(hookSource, /export interface UseEcommerceRequirementAnalysisRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceRequirementAnalysisRuntimeResult \{/);
  assert.match(hookSource, /handlePickEcommerceRequirementFile:/);
  assert.match(hookSource, /handleClearEcommerceRequirementFile:/);
  assert.match(hookSource, /handleResetEcommerceAnalysis:/);
  assert.match(hookSource, /handleAnalyzeEcommerceRequirement:/);
  assert.match(hookSource, /if \(!requirementFile\) \{/);
  assert.match(hookSource, /analyzeRequirementFile\(requirementFile\)/);
  assert.match(hookSource, /buildInitialEcommerceTaskStates\(analysis\)/);
  assert.doesNotMatch(hookSource, /ecommerceAnalysisClient/);

  assert.match(appSource, /useEcommerceRequirementAnalysisRuntime\(\{/);
  assert.match(appSource, /analyzeRequirementFile: analyzeEcommerceRequirementFile,/);
  assert.match(appSource, /setEcommerceRequirementAnalysisState: updateEcommerceRequirementAnalysisState/);
  assert.doesNotMatch(appSource, /await analyzeEcommerceRequirementFile/);
  assert.doesNotMatch(appSource, /const createEcommerceAnalysisResetPatch =/);
  assert.doesNotMatch(appSource, /const handlePickEcommerceRequirementFile = useCallback/);
  assert.doesNotMatch(appSource, /const handleClearEcommerceRequirementFile = useCallback/);
  assert.doesNotMatch(appSource, /const handleResetEcommerceAnalysis = useCallback/);
  assert.doesNotMatch(appSource, /const handleAnalyzeEcommerceRequirement = useCallback/);
});

test('ecommerce submit callback refreshes when analysis runtime state changes', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const submitHookSource = readSource('apps/web/src/app/useEcommerceSubmitRuntime.ts');
  const handleGenerateSource = appSource.slice(
    appSource.indexOf('const handleGenerate = useCallback'),
    appSource.indexOf('const handleFilesDrop = useCallback'),
  );
  const dependencyList = handleGenerateSource.slice(handleGenerateSource.lastIndexOf('}, ['));

  assert.match(appSource, /import \{ useEcommerceSubmitRuntime \} from '\.\/app\/useEcommerceSubmitRuntime';/);
  assert.match(appSource, /const \{ handleEcommerceSubmitGuard \} = useEcommerceSubmitRuntime\(\{/);
  assert.match(handleGenerateSource, /if \(await handleEcommerceSubmitGuard\(submitGuard\)\) \{/);
  assert.match(submitHookSource, /hasEcommerceAnalysis/);
  assert.match(submitHookSource, /await handleAnalyzeEcommerceRequirement\(\);/);
  assert.match(submitHookSource, /await handleConfirmEcommerceAnalysis\(\);/);
  assert.match(dependencyList, /handleEcommerceSubmitGuard/);
});

test('requirement analysis reset patch clears derived ecommerce analysis state', () => {
  const resetPatch = createEcommerceAnalysisResetPatch({ isAnalyzing: false });
  assert.deepEqual(resetPatch.selectedItems, {});
  assert.deepEqual(resetPatch.taskStates, {});
  assert.deepEqual(resetPatch.groupSlots, createEmptyEcommerceGroupSlots());
  assert.equal(resetPatch.analysis, null);
  assert.equal(resetPatch.analysisConfirmed, false);
  assert.equal(resetPatch.activeTaskNodeId, null);
  assert.equal(resetPatch.activeTaskState, null);
  assert.equal(resetPatch.activeGroupSheet, null);
  assert.equal(resetPatch.isConfirmingAnalysis, false);
  assert.equal(resetPatch.isAnalyzing, false);
  assert.equal('requirementFile' in resetPatch, false);

  const file = { name: 'requirements.xlsx' } as File;
  const filePatch = createEcommerceAnalysisResetPatch({ requirementFile: file });
  assert.equal(filePatch.requirementFile, file);
});

test('requirement analysis clear patch clears the requirement file and derived state', () => {
  const clearPatch = createEcommerceAnalysisResetPatch({
    requirementFile: null,
    isAnalyzing: false,
  });

  assert.equal(clearPatch.requirementFile, null);
  assert.equal(clearPatch.isAnalyzing, false);
  assert.deepEqual(clearPatch.itemReferenceFiles, {});
  assert.equal(clearPatch.analysis, null);
  assert.equal(clearPatch.analysisConfirmed, false);
  assert.deepEqual(clearPatch.selectedItems, {});
  assert.deepEqual(clearPatch.taskStates, {});
  assert.deepEqual(clearPatch.groupSlots, createEmptyEcommerceGroupSlots());
  assert.equal(clearPatch.activeTaskNodeId, null);
  assert.equal(clearPatch.activeTaskState, null);
  assert.equal(clearPatch.activeGroupSheet, null);
  assert.equal(clearPatch.isConfirmingAnalysis, false);
});

test('requirement analysis selected item defaults include main and A+ rows', () => {
  assert.deepEqual(buildEcommerceAnalysisSelectedItems(createAnalysis()), {
    'main-1': true,
    'main-2': true,
    'module-1': true,
  });
});

test('requirement analysis counts tolerate partial analyzer results', () => {
  const partialAnalysis = {
    ...createAnalysis(),
    mainImageItems: undefined,
    aPlusGroup: undefined,
  } as unknown as EcommerceAnalysisResult;

  assert.deepEqual(buildEcommerceAnalysisCounts(partialAnalysis), {
    mainImageCount: 0,
    aPlusModuleCount: 0,
  });
});

test('requirement analysis normalization defaults optional collections', () => {
  const partialAnalysis = {
    ...createAnalysis(),
    assets: undefined,
    mainImageItems: undefined,
    aPlusGroup: undefined,
    reviewWarnings: undefined,
  } as unknown as EcommerceAnalysisResult;

  const normalized = normalizeEcommerceAnalysisResult(partialAnalysis);
  assert.deepEqual(normalized.assets.productAssets, []);
  assert.deepEqual(normalized.assets.referenceAssets, []);
  assert.deepEqual(normalized.mainImageItems, []);
  assert.equal(normalized.aPlusGroup.groupId, 'aplus');
  assert.equal(normalized.aPlusGroup.title, 'A+');
  assert.deepEqual(normalized.aPlusGroup.modules, []);
  assert.deepEqual(normalized.aPlusGroup.groupWarnings, []);
  assert.deepEqual(normalized.reviewWarnings, []);
});

test('requirement analysis success patch initializes derived task state without clearing references', () => {
  const analysis = createAnalysis();
  const taskState = { taskId: 'task-main-1' } as EcommerceEditableTaskState;
  const patch = buildEcommerceAnalysisSuccessPatch({
    analysis,
    buildInitialEcommerceTaskStates: (receivedAnalysis) => {
      assert.deepEqual(receivedAnalysis, normalizeEcommerceAnalysisResult(analysis));
      return { 'main-1': taskState };
    },
  });

  assert.deepEqual(patch.analysis, normalizeEcommerceAnalysisResult(analysis));
  assert.equal(patch.analysisConfirmed, false);
  assert.deepEqual(patch.selectedItems, {
    'main-1': true,
    'main-2': true,
    'module-1': true,
  });
  assert.deepEqual(patch.taskStates, { 'main-1': taskState });
  assert.deepEqual(patch.groupSlots, createEmptyEcommerceGroupSlots());
  assert.equal(patch.activeTaskNodeId, null);
  assert.equal(patch.activeTaskState, null);
  assert.equal(patch.activeGroupSheet, null);
  assert.equal(patch.isAnalyzing, false);
  assert.equal(patch.isConfirmingAnalysis, false);
  assert.equal('itemReferenceFiles' in patch, false);
});

test('product image data builder extracts base64 payload and falls back to raw data url', async () => {
  const jpegBlob = new Blob(['ignored'], { type: 'image/jpeg' }) as File;
  const unknownBlob = new Blob(['ignored'], { type: '' }) as File;

  const result = await buildEcommerceProductImageData({
    productFiles: [jpegBlob, unknownBlob],
    readBlobAsDataUrl: async (blob) => {
      if (blob === jpegBlob) {
        return 'data:image/jpeg;base64,abc123';
      }
      return 'raw-data-url';
    },
  });

  assert.deepEqual(result, [
    { mimeType: 'image/jpeg', data: 'abc123' },
    { mimeType: 'image/png', data: 'raw-data-url' },
  ]);
});

test('requirement analysis runner warns without a requirement file', async () => {
  const patches: Array<Partial<EcommerceRequirementAnalysisRuntimeState>> = [];
  const notifications: Array<{ level: string; title: string; message: string }> = [];

  await runEcommerceRequirementAnalysis({
    ecommerceState: { requirementFile: null, productFiles: [] },
    enablePromptOptimization: false,
    readBlobAsDataUrl: async () => 'unused',
    analyzeRequirementFile: async () => {
      throw new Error('analyzer should not run');
    },
    enhanceAnalysisWithAI: async () => {
      throw new Error('enhancer should not run');
    },
    buildInitialEcommerceTaskStates: () => ({}),
    setEcommerceRequirementAnalysisState: (updater) => {
      const patch = updater({} as EcommerceRequirementAnalysisRuntimeState);
      if (patch) patches.push(patch);
    },
    notifyEcommerceAnalysis: async (level, title, message) => {
      notifications.push({ level, title, message });
    },
  });

  assert.deepEqual(patches, []);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].level, 'warning');
});

test('requirement analysis runner emits analyzing and success patches with optional enhancement', async () => {
  const requirementFile = { name: 'requirements.xlsx' } as File;
  const productFile = new Blob(['image'], { type: 'image/png' }) as File;
  const baseAnalysis = createAnalysis();
  const enhancedAnalysis = {
    ...createAnalysis(),
    mainImageItems: [
      { itemId: 'enhanced-main' },
    ] as EcommerceAnalysisResult['mainImageItems'],
    aPlusGroup: {
      ...createAnalysis().aPlusGroup,
      modules: [
        { moduleId: 'enhanced-module' },
      ] as EcommerceAnalysisResult['aPlusGroup']['modules'],
    },
  };
  const taskState = { taskId: 'task-enhanced-main' } as EcommerceEditableTaskState;
  const patches: Array<Partial<EcommerceRequirementAnalysisRuntimeState>> = [];
  const notifications: Array<{ level: string; title: string; message: string }> = [];

  await runEcommerceRequirementAnalysis({
    ecommerceState: { requirementFile, productFiles: [productFile] },
    enablePromptOptimization: true,
    readBlobAsDataUrl: async (blob) => {
      assert.equal(blob, productFile);
      return 'data:image/png;base64,productPayload';
    },
    analyzeRequirementFile: async (file) => {
      assert.equal(file, requirementFile);
      return baseAnalysis;
    },
    enhanceAnalysisWithAI: async (analysis, productImageData) => {
      assert.deepEqual(analysis, normalizeEcommerceAnalysisResult(baseAnalysis));
      assert.deepEqual(productImageData, [{ mimeType: 'image/png', data: 'productPayload' }]);
      return enhancedAnalysis;
    },
    buildInitialEcommerceTaskStates: (analysis) => {
      assert.deepEqual(analysis, normalizeEcommerceAnalysisResult(enhancedAnalysis));
      return { 'enhanced-main': taskState };
    },
    setEcommerceRequirementAnalysisState: (updater) => {
      const patch = updater({} as EcommerceRequirementAnalysisRuntimeState);
      if (patch) patches.push(patch);
    },
    notifyEcommerceAnalysis: async (level, title, message) => {
      notifications.push({ level, title, message });
    },
  });

  assert.deepEqual(patches[0], { isAnalyzing: true });
  assert.deepEqual(patches[1].analysis, normalizeEcommerceAnalysisResult(enhancedAnalysis));
  assert.deepEqual(patches[1].selectedItems, {
    'enhanced-main': true,
    'enhanced-module': true,
  });
  assert.deepEqual(patches[1].taskStates, { 'enhanced-main': taskState });
  assert.equal('itemReferenceFiles' in patches[1], false);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].level, 'success');
});

test('requirement analysis runner clears analyzing state on analyzer failure', async () => {
  const requirementFile = { name: 'requirements.xlsx' } as File;
  const patches: Array<Partial<EcommerceRequirementAnalysisRuntimeState>> = [];
  const notifications: Array<{ level: string; title: string; message: string }> = [];

  await runEcommerceRequirementAnalysis({
    ecommerceState: { requirementFile, productFiles: [] },
    enablePromptOptimization: false,
    readBlobAsDataUrl: async () => 'unused',
    analyzeRequirementFile: async () => {
      throw new Error('analysis failed');
    },
    enhanceAnalysisWithAI: async () => {
      throw new Error('enhancer should not run');
    },
    buildInitialEcommerceTaskStates: () => {
      throw new Error('task state builder should not run');
    },
    setEcommerceRequirementAnalysisState: (updater) => {
      const patch = updater({} as EcommerceRequirementAnalysisRuntimeState);
      if (patch) patches.push(patch);
    },
    notifyEcommerceAnalysis: async (level, title, message) => {
      notifications.push({ level, title, message });
    },
  });

  assert.deepEqual(patches, [
    { isAnalyzing: true },
    { isAnalyzing: false, isConfirmingAnalysis: false },
  ]);
  assert.equal(notifications.length, 1);
  assert.deepEqual(notifications[0], {
    level: 'error',
    title: '分析失败',
    message: 'analysis failed',
  });
});

test('requirement analysis runner falls back to base analysis when AI enhancement fails', async () => {
  const requirementFile = { name: 'requirements.xlsx' } as File;
  const productFile = new Blob(['image'], { type: 'image/jpeg' }) as File;
  const baseAnalysis = createAnalysis();
  const taskState = { taskId: 'task-main-1' } as EcommerceEditableTaskState;
  const patches: Array<Partial<EcommerceRequirementAnalysisRuntimeState>> = [];
  const notifications: Array<{ level: string; title: string; message: string }> = [];
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];

  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  try {
    await runEcommerceRequirementAnalysis({
      ecommerceState: { requirementFile, productFiles: [productFile] },
      enablePromptOptimization: true,
      readBlobAsDataUrl: async (blob) => {
        assert.equal(blob, productFile);
        return 'data:image/jpeg;base64,fallbackPayload';
      },
      analyzeRequirementFile: async (file) => {
        assert.equal(file, requirementFile);
        return baseAnalysis;
      },
      enhanceAnalysisWithAI: async (analysis, productImageData) => {
        assert.deepEqual(analysis, normalizeEcommerceAnalysisResult(baseAnalysis));
        assert.deepEqual(productImageData, [{ mimeType: 'image/jpeg', data: 'fallbackPayload' }]);
        throw new Error('enhancer failed');
      },
      buildInitialEcommerceTaskStates: (analysis) => {
        assert.deepEqual(analysis, normalizeEcommerceAnalysisResult(baseAnalysis));
        return { 'main-1': taskState };
      },
      setEcommerceRequirementAnalysisState: (updater) => {
        const patch = updater({} as EcommerceRequirementAnalysisRuntimeState);
        if (patch) patches.push(patch);
      },
      notifyEcommerceAnalysis: async (level, title, message) => {
        notifications.push({ level, title, message });
      },
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(patches[0], { isAnalyzing: true });
  assert.deepEqual(patches[1].analysis, normalizeEcommerceAnalysisResult(baseAnalysis));
  assert.deepEqual(patches[1].taskStates, { 'main-1': taskState });
  assert.equal(warnings.length, 1);
  assert.equal(notifications.length, 1);
  assert.deepEqual(notifications[0], {
    level: 'success',
    title: '\u5206\u6790\u5b8c\u6210',
    message: '\u5df2\u89e3\u6790\u4e3b\u56fe 2 \u6761\uff0cA+ 1 \u6761\u3002',
  });
});

test('requirement analysis runner stores normalized partial analyzer results', async () => {
  const requirementFile = { name: 'requirements.xlsx' } as File;
  const partialAnalysis = {
    ...createAnalysis(),
    mainImageItems: undefined,
    aPlusGroup: undefined,
  } as unknown as EcommerceAnalysisResult;
  const patches: Array<Partial<EcommerceRequirementAnalysisRuntimeState>> = [];
  const notifications: Array<{ level: string; title: string; message: string }> = [];

  await runEcommerceRequirementAnalysis({
    ecommerceState: { requirementFile, productFiles: [] },
    enablePromptOptimization: false,
    readBlobAsDataUrl: async () => 'unused',
    analyzeRequirementFile: async (file) => {
      assert.equal(file, requirementFile);
      return partialAnalysis;
    },
    enhanceAnalysisWithAI: async () => {
      throw new Error('enhancer should not run');
    },
    buildInitialEcommerceTaskStates: (analysis) => {
      assert.deepEqual(analysis.mainImageItems, []);
      assert.deepEqual(analysis.aPlusGroup.modules, []);
      return {};
    },
    setEcommerceRequirementAnalysisState: (updater) => {
      const patch = updater({} as EcommerceRequirementAnalysisRuntimeState);
      if (patch) patches.push(patch);
    },
    notifyEcommerceAnalysis: async (level, title, message) => {
      notifications.push({ level, title, message });
    },
  });

  assert.deepEqual(patches[0], { isAnalyzing: true });
  assert.deepEqual(patches[1].analysis?.mainImageItems, []);
  assert.deepEqual(patches[1].analysis?.aPlusGroup.modules, []);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].level, 'success');
  assert.match(notifications[0].message, /主图 0 条/);
  assert.match(notifications[0].message, /A\+ 0 条/);
});
