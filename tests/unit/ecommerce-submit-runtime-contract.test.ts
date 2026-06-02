import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce submit runtime owns the ecommerce submit branch in handleGenerate', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceSubmitRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'apps/web/src/app/useEcommerceSubmitRuntime.ts should exist');

  const appSource = readSource('apps/web/src/App.tsx');
  const hookSource = readSource('apps/web/src/app/useEcommerceSubmitRuntime.ts');
  const handleGenerateSource = appSource.slice(
    appSource.indexOf('const handleGenerate = useCallback'),
    appSource.indexOf('const handleFilesDrop = useCallback'),
  );
  const dependencyList = handleGenerateSource.slice(handleGenerateSource.lastIndexOf('}, ['));

  assert.match(hookSource, /export interface UseEcommerceSubmitRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceSubmitRuntimeResult \{/);
  assert.match(hookSource, /handleEcommerceSubmitGuard: \(submitGuard: EcommerceSubmitGuardState\) => Promise<boolean>;/);
  assert.match(hookSource, /if \(!submitGuard\.isEcommerce\)/);
  assert.match(hookSource, /await handleAnalyzeEcommerceRequirement\(\);/);
  assert.match(hookSource, /if \(analysisConfirmed\) \{/);
  assert.match(hookSource, /await handleConfirmEcommerceAnalysis\(\);/);

  assert.match(appSource, /import \{ useEcommerceSubmitRuntime \} from '\.\/app\/useEcommerceSubmitRuntime';/);
  assert.match(appSource, /const \{ handleEcommerceSubmitGuard \} = useEcommerceSubmitRuntime\(\{/);
  assert.match(appSource, /analysisConfirmed: ecommerceState\.analysisConfirmed,/);
  assert.match(handleGenerateSource, /if \(await handleEcommerceSubmitGuard\(submitGuard\)\) \{/);
  assert.doesNotMatch(handleGenerateSource, /if \(submitGuard\.isEcommerce\) \{/);
  assert.match(dependencyList, /handleEcommerceSubmitGuard/);
  assert.doesNotMatch(dependencyList, /ecommerceState\.analysis/);
});

test('ecommerce optimization contract for 1128px width, 600x450 aspect sizing and mobile resolution normalization', () => {
  const cardWidthSource = readSource('apps/web/src/utils/promptNodeCardWidth.ts');
  const autoArrangeSource = readSource('apps/web/src/context/canvasAutoArrange.ts');
  const renderTaskBuilderSource = readSource('apps/web/src/services/ecommerce/renderTaskBuilder.ts');
  const exportRuntimeSource = readSource('apps/web/src/app/useEcommerceGroupExportRuntime.ts');

  // 1. 验证 1128px 共享宽度契约
  assert.match(cardWidthSource, /export const ECOMMERCE_FRAMEWORK_PROMPT_CARD_WIDTH = 1128;/);
  assert.match(autoArrangeSource, /import \{ ECOMMERCE_FRAMEWORK_PROMPT_CARD_WIDTH \} from '\.\.\/utils\/promptNodeCardWidth\.ts';/);
  assert.match(autoArrangeSource, /ECOMMERCE_FRAMEWORK_PROMPT_CARD_WIDTH/);

  // 2. 验证 600x450 走 4:3 手机端比例契约与“紧凑 4:3 手机端成品”描述
  assert.match(renderTaskBuilderSource, /businessSizeTier === '600x450'/);
  assert.match(renderTaskBuilderSource, /本张画面为紧凑 4:3 手机端成品/);
  assert.match(renderTaskBuilderSource, /输出必须符合 600\*450 比例，可以是 600\*450 或任意等比例高分辨率倍数/);

  // 3. 验证导出流程中的真实像素归一化逻辑
  assert.match(exportRuntimeSource, /async function normalizeImageToAPUSMobile/);
  assert.match(exportRuntimeSource, /targetWidth = 600 \* k/);
  assert.match(exportRuntimeSource, /targetHeight = 450 \* k/);
  assert.match(exportRuntimeSource, /normalizeImageToAPUSMobile\(blob[^)]*\)/);
});
