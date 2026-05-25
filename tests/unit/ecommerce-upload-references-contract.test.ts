import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type { EcommerceManualReferenceBinding } from '../../apps/web/src/app/useEcommerceUploadReferenceRuntime.ts';
import type { EcommerceAnalysisAsset } from '../../apps/web/src/services/ecommerce/types.ts';
import type { EcommerceEditableTaskState, ReferenceImage } from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();



function readInterfaceBlock(source: string, interfaceName: string): string {
  const match = source.match(new RegExp(`export interface ${interfaceName} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${interfaceName} should be exported`);
  return match[0];
}

test('ecommerce upload reference runtime owns upload helpers and handlers', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceUploadReferenceRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceUploadReferenceRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceUploadReferenceRuntime.ts');

  assert.match(appSource, /import \{[\s\S]*?useEcommerceUploadReferenceRuntime,[\s\S]*?type EcommerceManualReferenceBinding,[\s\S]*?type SetEcommerceUploadReferenceState[\s\S]*?\} from '\.\/app\/useEcommerceUploadReferenceRuntime';/);
  assert.doesNotMatch(appSource, /type EcommerceUploadReferenceBundle,/);

  const depsBlock = readInterfaceBlock(hookSource, 'UseEcommerceUploadReferenceRuntimeDeps');
  const resultBlock = readInterfaceBlock(hookSource, 'UseEcommerceUploadReferenceRuntimeResult');

  assert.match(depsBlock, /ecommerceState: EcommerceUploadReferenceState;/);
  assert.match(depsBlock, /setEcommerceUploadReferenceState: SetEcommerceUploadReferenceState;/);
  assert.match(depsBlock, /readBlobAsDataUrl: \(blob: Blob\) => Promise<string>;/);

  assert.match(resultBlock, /buildProductImageRef: \(referenceImage\?: ReferenceImage \| null\) => EcommerceImageRef \| undefined;/);
  assert.match(resultBlock, /buildReferenceImageSignature: \(referenceImages: ReferenceImage\[\]\) => string;/);
  assert.match(resultBlock, /buildEcommerceImageRefSignature: \(reference\?: EcommerceImageRef\) => string;/);
  assert.match(resultBlock, /buildTaskStateSyncSignature: \(taskState\?: EcommerceEditableTaskState \| null\) => string;/);
  assert.match(resultBlock, /createReferenceImageFromFile: \(file: File, labelPrefix: string\) => Promise<ReferenceImage>;/);
  assert.match(resultBlock, /createReferenceImageFromAsset: \(asset: EcommerceAnalysisAsset\) => ReferenceImage \| null;/);
  assert.match(resultBlock, /buildCurrentEcommerceUploadReferences: \(\) => Promise<EcommerceUploadReferenceBundle>;/);
  assert.match(resultBlock, /extractEcommerceManualReferenceBindings: \(taskStateSeed\?: EcommerceEditableTaskState \| null\) => EcommerceManualReferenceBinding\[\];/);
  assert.match(resultBlock, /handlePickEcommerceProductFiles: \(files: FileList \| File\[\]\) => void;/);
  assert.match(resultBlock, /handlePickEcommerceExtraReferenceFiles: \(files: FileList \| File\[\]\) => void;/);
  assert.match(resultBlock, /handleRemoveEcommerceProductFile: \(index: number\) => void;/);
  assert.match(resultBlock, /handleRemoveEcommerceExtraReferenceFile: \(index: number\) => void;/);
  assert.match(resultBlock, /handlePickEcommerceItemReferenceFiles: \(sourceKey: string, files: FileList \| File\[\]\) => Promise<void>;/);
  assert.match(resultBlock, /handleRemoveEcommerceItemReferenceFile: \(sourceKey: string, index: number\) => void;/);

  assert.match(hookSource, /export const MAX_ECOMMERCE_PRODUCT_FILES = 4;/);
  assert.match(hookSource, /export const MAX_ECOMMERCE_EXTRA_REFERENCE_FILES = 4;/);
  assert.match(hookSource, /export const MAX_ECOMMERCE_ITEM_REFERENCE_FILES = 6;/);
  assert.match(hookSource, /appendUploadFilesWithinLimit\(\s*previousState\.productFiles \|\| \[\],/);
  assert.match(hookSource, /appendUploadFilesWithinLimit\(\s*previousState\.extraReferenceFiles \|\| \[\],/);
  assert.match(hookSource, /\.slice\(0, MAX_ECOMMERCE_ITEM_REFERENCE_FILES\)/);
  assert.doesNotMatch(hookSource, /extractEcommerceManualReferenceBindings[\s\S]*?\), \[ecommerceState\]\);/);
  assert.match(hookSource, /extractEcommerceManualReferenceBindings[\s\S]*?\), \[itemReferenceFiles\]\);/);

  assert.match(appSource, /const updateEcommerceUploadReferenceState = useCallback/);
  assert.match(appSource, /const \{[\s\S]*?buildCurrentEcommerceUploadReferences,[\s\S]*?extractEcommerceManualReferenceBindings,[\s\S]*?handlePickEcommerceProductFiles,[\s\S]*?handleRemoveEcommerceItemReferenceFile[\s\S]*?\} = useEcommerceUploadReferenceRuntime\(\{/);
  assert.match(appSource, /setEcommerceUploadReferenceState: updateEcommerceUploadReferenceState,/);
  assert.match(appSource, /readBlobAsDataUrl,/);

  assert.doesNotMatch(appSource, /const sanitizeReferenceToken = useCallback/);
  assert.doesNotMatch(appSource, /const buildUploadReferenceIdentity = useCallback/);
  assert.doesNotMatch(appSource, /const buildProductImageRef = useCallback/);
  assert.doesNotMatch(appSource, /const buildReferenceImageSignature = useCallback/);
  assert.doesNotMatch(appSource, /const buildEcommerceImageRefSignature = useCallback/);
  assert.doesNotMatch(appSource, /const buildTaskStateSyncSignature = useCallback/);
  assert.doesNotMatch(appSource, /const createReferenceImageFromFile = useCallback/);
  assert.doesNotMatch(appSource, /const createReferenceImageFromAsset = useCallback/);
  assert.doesNotMatch(appSource, /const buildCurrentEcommerceUploadReferences = useCallback/);
  assert.doesNotMatch(appSource, /const extractEcommerceManualReferenceBindings = useCallback/);
  assert.doesNotMatch(appSource, /const handlePickEcommerceProductFiles = useCallback/);
  assert.doesNotMatch(appSource, /const handlePickEcommerceExtraReferenceFiles = useCallback/);
  assert.doesNotMatch(appSource, /const handleRemoveEcommerceProductFile = useCallback/);
  assert.doesNotMatch(appSource, /const handleRemoveEcommerceExtraReferenceFile = useCallback/);
  assert.doesNotMatch(appSource, /const handlePickEcommerceItemReferenceFiles = useCallback/);
  assert.doesNotMatch(appSource, /const handleRemoveEcommerceItemReferenceFile = useCallback/);
});

test('ecommerce upload helper functions preserve identity, signatures, and manual binding lookup', async () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceUploadReferenceRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceUploadReferenceRuntime.ts should exist');

  const runtime = await import('../../apps/web/src/app/useEcommerceUploadReferenceRuntime.ts');
  const productFile = new File(['abc'], 'Product Shot 01.PNG', {
    type: 'image/png',
    lastModified: 1234,
  });
  const textFile = new File(['notes'], 'notes.txt', {
    type: 'text/plain',
    lastModified: 5678,
  });

  assert.deepEqual(runtime.filterEcommerceImageFiles([productFile, textFile]).map((file) => file.name), [
    'Product Shot 01.PNG',
  ]);
  assert.equal(
    runtime.buildUploadReferenceIdentity(productFile, 'product-1'),
    'product-1-product-shot-01.png-3-1234',
  );

  const referenceImage = await runtime.createReferenceImageFromFile(
    productFile,
    'product-1',
    async () => 'data:image/png;base64,YWJj',
  );
  assert.deepEqual(referenceImage, {
    id: 'product-1-product-shot-01.png-3-1234',
    storageId: 'product-1-product-shot-01.png-3-1234',
    data: 'YWJj',
    mimeType: 'image/png',
    url: 'data:image/png;base64,YWJj',
  });
  assert.deepEqual(runtime.buildProductImageRef(referenceImage), {
    id: referenceImage.id,
    storageId: referenceImage.storageId,
    label: '产品图1',
    mimeType: 'image/png',
    url: referenceImage.url,
  });
  assert.equal(runtime.buildProductImageRef(null), undefined);

  const assetReference = runtime.createReferenceImageFromAsset({
    assetId: 'asset-1',
    previewUrl: 'data:image/jpeg;base64,Zm9v',
    mimeType: 'image/jpeg',
  } as EcommerceAnalysisAsset);
  assert.deepEqual(assetReference, {
    id: 'analysis-asset-1',
    storageId: 'asset-1',
    data: 'Zm9v',
    mimeType: 'image/jpeg',
    url: 'data:image/jpeg;base64,Zm9v',
  });
  assert.equal(runtime.createReferenceImageFromAsset({ assetId: 'empty' } as EcommerceAnalysisAsset), null);

  assert.equal(runtime.buildReferenceImageSignature([referenceImage]), [
    referenceImage.id,
    referenceImage.storageId,
    referenceImage.mimeType,
    referenceImage.url,
    referenceImage.data,
  ].join('|'));
  assert.equal(runtime.buildEcommerceImageRefSignature(runtime.buildProductImageRef(referenceImage)), [
    referenceImage.id,
    referenceImage.storageId,
    '产品图1',
    referenceImage.mimeType,
    referenceImage.url,
  ].join('|'));

  const manualReference: EcommerceManualReferenceBinding = {
    assetId: 'manual-1',
    label: 'manual',
    fileName: 'manual.png',
    referenceImage: referenceImage as ReferenceImage,
    assetRole: {
      assetId: 'manual-1',
      role: 'reference',
      label: 'manual',
      normalizedLabel: 'manual',
      source: 'upload',
    },
  };
  const taskStateSeed = { sourceRowKey: 'row-1' } as EcommerceEditableTaskState;
  assert.deepEqual(
    runtime.extractEcommerceManualReferenceBindingsFromState({
      itemReferenceFiles: { 'row-1': [manualReference] },
    }, taskStateSeed),
    [manualReference],
  );
  assert.deepEqual(
    runtime.extractEcommerceManualReferenceBindingsFromState({
      itemReferenceFiles: { 'row-1': [manualReference] },
    }, null),
    [],
  );
});

test('ecommerce upload removal helpers avoid no-op state churn and clean empty manual buckets', async () => {
  const runtime = await import('../../apps/web/src/app/useEcommerceUploadReferenceRuntime.ts');
  const first = new File(['a'], 'first.png', { type: 'image/png', lastModified: 1 });
  const second = new File(['b'], 'second.png', { type: 'image/png', lastModified: 2 });
  const referenceImage: ReferenceImage = {
    id: 'manual-1',
    storageId: 'manual-1',
    data: 'a',
    mimeType: 'image/png',
    url: 'data:image/png;base64,YQ==',
  };
  const manualReference: EcommerceManualReferenceBinding = {
    assetId: 'manual-1',
    label: 'manual',
    fileName: 'manual.png',
    referenceImage,
    assetRole: {
      assetId: 'manual-1',
      role: 'reference',
      label: 'manual',
      normalizedLabel: 'manual',
      source: 'upload',
    },
  };

  assert.deepEqual(
    runtime.removeEcommerceProductFileFromState({ productFiles: [first, second] }, 0),
    { productFiles: [second] },
  );
  assert.equal(runtime.removeEcommerceProductFileFromState({ productFiles: [first] }, 4), null);
  assert.equal(runtime.removeEcommerceExtraReferenceFileFromState({ extraReferenceFiles: [first] }, -1), null);
  assert.deepEqual(
    runtime.removeEcommerceItemReferenceFileFromState({
      itemReferenceFiles: {
        'row-1': [manualReference],
        'row-2': [manualReference],
      },
    }, 'row-1', 0),
    {
      itemReferenceFiles: {
        'row-2': [manualReference],
      },
    },
  );
  assert.equal(
    runtime.removeEcommerceItemReferenceFileFromState({
      itemReferenceFiles: {
        'row-1': [manualReference],
      },
    }, 'missing-row', 0),
    null,
  );
});
