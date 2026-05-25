import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce submit runtime owns the ecommerce submit branch in handleGenerate', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceSubmitRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceSubmitRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceSubmitRuntime.ts');
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
  assert.match(hookSource, /await handleConfirmEcommerceAnalysis\(\);/);

  assert.match(appSource, /import \{ useEcommerceSubmitRuntime \} from '\.\/app\/useEcommerceSubmitRuntime';/);
  assert.match(appSource, /const \{ handleEcommerceSubmitGuard \} = useEcommerceSubmitRuntime\(\{/);
  assert.match(handleGenerateSource, /if \(await handleEcommerceSubmitGuard\(submitGuard\)\) \{/);
  assert.doesNotMatch(handleGenerateSource, /if \(submitGuard\.isEcommerce\) \{/);
  assert.match(dependencyList, /handleEcommerceSubmitGuard/);
  assert.doesNotMatch(dependencyList, /ecommerceState\.analysis/);
});
