import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type { EcommerceAnalysisResult } from '../../apps/web/src/services/ecommerce/types.ts';
import type { EcommerceEditableTaskState } from '../../apps/web/src/types.ts';
import {
  buildInitialEcommerceTaskStatesFromAnalysis,
  resolveNextEcommerceTaskStatePatch,
} from '../../apps/web/src/app/useEcommerceTaskStateRuntime.ts';

const ROOT_DIR = process.cwd();



function createTask(overrides: Partial<EcommerceEditableTaskState> = {}): EcommerceEditableTaskState {
  return {
    taskId: 'task-1',
    sourceKind: 'main-image',
    sourceSheet: '主图',
    sourceRowKey: 'row-1',
    theme: '',
    outputTypeLabel: 'Main',
    imageRoleSummary: [],
    sparseUserIntent: '',
    copy: { headline: '', subheadline: '', highlight: '', featureTags: [], cta: '' },
    style: { tone: '', atmosphere: '', effect: '', backgroundType: '' },
    layout: { productSize: 'balanced', textPosition: 'top-left', accessoryPolicy: 'auto' },
    inherit: {
      keepSeriesStyle: true,
      keepFontStyle: true,
      keepLayoutStyle: true,
      keepCopyStyle: true,
      keepPalette: true,
    },
    assetRoles: [],
    consistencyChecks: [],
    missingFields: [],
    resolvedPromptPreview: '',
    displayLabel: '',
    ...overrides,
  };
}

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
    assets: {
      productAssets: [],
      referenceAssets: [],
    },
    mainImageItems: [
      {
        itemId: 'main-1',
        sheet: '主图',
        rowIndex: 1,
        sequence: 1,
        type: '',
        angle: '',
        theme: '',
        designRequirements: '',
        copyText: '',
        sizePolicy: 'sheet-native',
        referenceAssetIds: [],
        referenceMentions: [],
        productAssetRequired: false,
        promptDraft: '',
        editableTask: createTask({
          taskId: 'main-task',
          sourceKind: 'main-image',
          sourceSheet: '主图',
          sourceRowKey: 'main-1',
        }),
        needsReview: false,
        reviewWarnings: [],
      },
      {
        itemId: 'main-empty',
        sheet: '主图',
        rowIndex: 2,
        sequence: 2,
        type: '',
        angle: '',
        theme: '',
        designRequirements: '',
        copyText: '',
        sizePolicy: 'sheet-native',
        referenceAssetIds: [],
        referenceMentions: [],
        productAssetRequired: false,
        promptDraft: '',
        needsReview: false,
        reviewWarnings: [],
      },
    ],
    aPlusGroup: {
      groupId: 'aplus',
      title: 'A+',
      modules: [
        {
          moduleId: 'module-1',
          sheet: 'A+',
          rowIndex: 3,
          moduleName: '',
          type: '',
          declaredSizeText: '',
          angle: '',
          sellingPoints: '',
          designRequirements: '',
          copyText: '',
          sizePolicy: 'desktop-then-mobile',
          referenceAssetIds: [],
          referenceMentions: [],
          productAssetRequired: false,
          promptDraft: '',
          editableTask: createTask({
            taskId: 'module-task',
            sourceKind: 'a-plus-module',
            sourceSheet: 'A+',
            sourceRowKey: 'module-1',
          }),
          needsReview: false,
          reviewWarnings: [],
        },
      ],
      groupWarnings: [],
    },
    reviewWarnings: [],
  };
}

test('ecommerce task state runtime owns initial task-state sizing and App wiring', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceTaskStateRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'apps/web/src/app/useEcommerceTaskStateRuntime.ts should exist');

  const appSource = readSource('apps/web/src/App.tsx');
  const hookSource = readSource('apps/web/src/app/useEcommerceTaskStateRuntime.ts');

  assert.match(hookSource, /export interface UseEcommerceTaskStateRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceTaskStateRuntimeResult \{/);
  assert.match(hookSource, /buildInitialEcommerceTaskStates:/);
  assert.match(hookSource, /handleChangeEcommerceTaskState:/);
  assert.match(appSource, /useEcommerceTaskStateRuntime\(\{/);
  assert.doesNotMatch(appSource, /const buildInitialEcommerceTaskStates = useCallback/);
  assert.doesNotMatch(appSource, /const handleChangeEcommerceTaskState = useCallback/);
});

test('initial ecommerce task states are keyed by source row and pass through sizing', () => {
  const sizedTaskIds: string[] = [];
  const result = buildInitialEcommerceTaskStatesFromAnalysis({
    analysis: createAnalysis(),
    applyEffectiveSizingToTaskState: (taskState) => {
      sizedTaskIds.push(taskState.taskId);
      return {
        ...taskState,
        displayLabel: `sized:${taskState.taskId}`,
      };
    },
  });

  assert.deepEqual(Object.keys(result).sort(), ['main-1', 'module-1']);
  assert.deepEqual(sizedTaskIds, ['main-task', 'module-task']);
  assert.equal(result['main-1']?.displayLabel, 'sized:main-task');
  assert.equal(result['module-1']?.displayLabel, 'sized:module-task');
});

test('task state runtime updates matching row keys, task ids, and active drafts', () => {
  let updaterCalls = 0;
  const previousState = {
    taskStates: {
      'row-1': createTask({ taskId: 'shared-task', sourceRowKey: 'row-1', displayLabel: 'stored' }),
      'row-2': createTask({ taskId: 'other-task', sourceRowKey: 'row-2', displayLabel: 'other' }),
    },
    activeTaskState: createTask({ taskId: 'shared-task', sourceRowKey: 'active-row', displayLabel: 'active' }),
  };

  const patch = resolveNextEcommerceTaskStatePatch({
    previousState,
    taskId: 'shared-task',
    updater: (taskState) => ({
      ...taskState,
      displayLabel: `updated-${++updaterCalls}`,
    }),
    applyEffectiveSizingToTaskState: (taskState) => ({
      ...taskState,
      resolvedPromptPreview: `sized:${taskState.displayLabel}`,
    }),
  });

  assert.equal(patch?.taskStates['row-1']?.displayLabel, 'updated-1');
  assert.equal(patch?.taskStates['row-1']?.resolvedPromptPreview, 'sized:updated-1');
  assert.equal(patch?.taskStates['row-2'], previousState.taskStates['row-2']);
  assert.equal(patch?.activeTaskState?.displayLabel, 'updated-2');
  assert.equal(patch?.activeTaskState?.resolvedPromptPreview, 'sized:updated-2');

  const rowKeyPatch = resolveNextEcommerceTaskStatePatch({
    previousState,
    taskId: 'row-2',
    updater: (taskState) => ({ ...taskState, displayLabel: 'row-key-updated' }),
    applyEffectiveSizingToTaskState: (taskState) => taskState,
  });
  assert.equal(rowKeyPatch?.taskStates['row-2']?.displayLabel, 'row-key-updated');
  assert.equal(rowKeyPatch?.activeTaskState, previousState.activeTaskState);
});

test('task state runtime returns no patch when no task matches', () => {
  const previousState = {
    taskStates: {
      'row-1': createTask({ taskId: 'task-1', sourceRowKey: 'row-1' }),
    },
    activeTaskState: createTask({ taskId: 'active-task', sourceRowKey: 'active-row' }),
  };

  const patch = resolveNextEcommerceTaskStatePatch({
    previousState,
    taskId: 'missing-task',
    updater: (taskState) => ({ ...taskState, displayLabel: 'should-not-apply' }),
    applyEffectiveSizingToTaskState: (taskState) => taskState,
  });

  assert.equal(patch, null);
});
