import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  applyEffectiveSizingToEcommerceTaskState,
  createDefaultEcommerceSheetSettings,
  resolveEcommerceAPlusControlModeValue,
  resolveEcommerceNodeGenerationSettingsForSheet,
  resolveNextEcommerceSheetSetting,
} from '../../apps/web/src/app/useEcommerceSheetSettingsRuntime.ts';
import { AspectRatio, GenerationMode, ImageSize, type EcommerceEditableTaskState, type PromptNode } from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

function createAPlusTask(overrides: Partial<EcommerceEditableTaskState> = {}): EcommerceEditableTaskState {
  return {
    taskId: 'task-1',
    sourceKind: 'a-plus-module',
    sourceSheet: 'A+',
    sourceRowKey: 'module-1',
    theme: '',
    outputTypeLabel: 'A+',
    sizeTier: '1464x600',
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

function createAPlusPromptNode(overrides: Partial<PromptNode> = {}): PromptNode {
  return {
    id: 'node-1',
    prompt: 'node',
    position: { x: 0, y: 0 },
    aspectRatio: AspectRatio.LANDSCAPE_16_9,
    imageSize: ImageSize.SIZE_1K,
    model: 'gemini-3.1-flash-image-preview',
    mode: GenerationMode.ECOMMERCE,
    childImageIds: [],
    timestamp: 1,
    ecommerce: {
      kind: 'a-plus-module',
      sourceSheet: 'A+',
      sourceRowKey: 'module-1',
      sizePolicy: 'desktop-then-mobile',
      effectiveSizePolicy: 'desktop-then-mobile',
      currentAspectRatio: AspectRatio.LANDSCAPE_16_9,
      desktopAspectRatio: AspectRatio.LANDSCAPE_21_9,
      mobileAspectRatio: AspectRatio.LANDSCAPE_4_3,
      editableTask: createAPlusTask(),
    },
    ...overrides,
  } as PromptNode;
}

test('ecommerce sheet settings runtime owns sheet defaults, sizing helpers, and App wiring', () => {
  const hookPath = path.join(ROOT_DIR, 'src/app/useEcommerceSheetSettingsRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceSheetSettingsRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceSheetSettingsRuntime.ts');

  assert.match(hookSource, /export interface UseEcommerceSheetSettingsRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceSheetSettingsRuntimeResult \{/);
  assert.match(hookSource, /handleUpdateEcommerceSheetSetting: \(sheet: EcommerceGroupSheet, patch: EcommerceSheetSettingPatch\) => void;/);
  assert.match(hookSource, /createDefaultEcommerceSheetSettings/);
  assert.match(hookSource, /applyEffectiveSizingToEcommerceTaskState/);
  assert.match(hookSource, /resolveEcommerceNodeGenerationSettingsForSheet/);
  assert.match(hookSource, /sheet === 'A\+'\s*\?\s*\{ \.\.\.mergedSetting, imageSize: ImageSize\.SIZE_4K \}/);

  assert.match(appSource, /useEcommerceSheetSettingsRuntime\(\{/);
  assert.match(appSource, /setEcommerceSheetSettingsState: updateEcommerceSheetSettingsState/);
  assert.match(appSource, /const \{\s*resolveEcommerceAPlusControlMode,\s*applyEffectiveSizingToTaskState,\s*resolveEcommerceNodeGenerationSettings,\s*handleUpdateEcommerceSheetSetting,\s*\} = useEcommerceSheetSettingsRuntime\(\{/s);
  assert.doesNotMatch(appSource, /const createDefaultEcommerceSheetSettings =/);
  assert.doesNotMatch(appSource, /const resolveEcommerceAPlusControlMode = useCallback/);
  assert.doesNotMatch(appSource, /const applyEffectiveSizingToTaskState = useCallback/);
  assert.doesNotMatch(appSource, /const resolveEcommerceNodeGenerationSettings = useCallback/);
  assert.doesNotMatch(appSource, /const handleUpdateEcommerceSheetSetting = useCallback/);
});

test('sheet settings helpers preserve default sizes and A+ sizing policy behavior', () => {
  const defaults = createDefaultEcommerceSheetSettings('gemini-3.1-flash-image-preview');
  assert.equal(defaults['主图'].aspectRatio, AspectRatio.AUTO);
  assert.equal(defaults['主图'].imageSize, ImageSize.SIZE_4K);
  assert.equal(defaults['A+'].aspectRatio, AspectRatio.LANDSCAPE_16_9);
  assert.equal(defaults['A+'].imageSize, ImageSize.SIZE_4K);
  assert.equal(defaults['A+'].aPlusControlMode, 'auto');

  assert.equal(resolveEcommerceAPlusControlModeValue(), 'auto');
  assert.equal(resolveEcommerceAPlusControlModeValue({ aspectRatio: AspectRatio.LANDSCAPE_16_9, imageSize: ImageSize.SIZE_4K, aPlusControlMode: '600x450' }), '600x450');

  const resized = applyEffectiveSizingToEcommerceTaskState({
    taskState: createAPlusTask(),
    modelId: 'gemini-3.1-flash-image-preview',
    controlMode: '600x450',
  });
  assert.equal(resized.effectiveSizePolicy, 'sheet-native');
  assert.equal(resized.effectiveSizeTier, '600x450');

  const mainTask = applyEffectiveSizingToEcommerceTaskState({
    taskState: createAPlusTask({
      sourceKind: 'main-image',
      sourceSheet: '主图',
      sizeTier: undefined,
      effectiveSizeTier: undefined,
    }),
    modelId: 'gemini-3.1-flash-image-preview',
  });
  assert.equal(mainTask.effectiveSizeTier, undefined);

  const noOpPatch = resolveNextEcommerceSheetSetting({
    sheet: 'A+',
    modelId: 'gemini-3.1-flash-image-preview',
    sheetSettings: defaults,
    patch: { aPlusControlMode: 'auto', imageSize: ImageSize.SIZE_1K },
  });
  assert.equal(noOpPatch, null);

  const forcedAPlusPatch = resolveNextEcommerceSheetSetting({
    sheet: 'A+',
    modelId: 'gemini-3.1-flash-image-preview',
    sheetSettings: defaults,
    patch: { aPlusControlMode: '600x450', imageSize: ImageSize.SIZE_1K },
  });
  assert.equal(forcedAPlusPatch?.imageSize, ImageSize.SIZE_4K);
  assert.equal(forcedAPlusPatch?.aPlusControlMode, '600x450');
});

test('node generation settings preserve desktop and mobile A+ targets', () => {
  const node = createAPlusPromptNode();
  const sheetSettings = createDefaultEcommerceSheetSettings('gemini-3.1-flash-image-preview');

  const desktopSettings = resolveEcommerceNodeGenerationSettingsForSheet({
    node,
    sheetSettings,
  });
  assert.equal(desktopSettings.aspectRatio, AspectRatio.LANDSCAPE_21_9);
  assert.equal(desktopSettings.imageSize, ImageSize.SIZE_4K);

  const mobileSettings = resolveEcommerceNodeGenerationSettingsForSheet({
    node,
    sheetSettings,
    generationTarget: 'mobile',
  });
  assert.equal(mobileSettings.aspectRatio, AspectRatio.LANDSCAPE_4_3);
  assert.equal(mobileSettings.imageSize, ImageSize.SIZE_4K);
});
