import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce mobile continuation runtime owns mobile follow-up handlers', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceMobileContinuationRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceMobileContinuationRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceMobileContinuationRuntime.ts');
  const mobileWorkspaceSource = readSource('src/app/AppMobileWorkspace.tsx');

  assert.match(hookSource, /export interface UseEcommerceMobileContinuationRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceMobileContinuationRuntimeResult \{/);
  assert.match(hookSource, /const resolveMobileResultPromptNode = useCallback/);
  assert.match(hookSource, /handleMobileEditEcommerceTask: \(entry: MobileResultEntry\) => void;/);
  assert.match(hookSource, /handleMobileToggleEcommerceSelected: \(entry: MobileResultEntry, selected: boolean\) => void;/);
  assert.match(hookSource, /handleMobileConfirmEcommerceDesktop: \(entry: MobileResultEntry\) => void;/);
  assert.match(hookSource, /handleMobileGenerateEcommerceMobile: \(entry: MobileResultEntry\) => void;/);
  assert.match(hookSource, /entry\.ecommerceContinuation\?\.canGenerateMobile/);
  assert.match(hookSource, /enqueueEcommerceFrameworkNodes\(frameworkId, \[promptNode\], 'mobile'\)/);
  assert.match(hookSource, /pumpEcommerceFrameworkQueue\(frameworkId\)/);
  assert.match(hookSource, /handleRetryEcommerceModule\(promptNode\)/);
  assert.match(hookSource, /setMobileScreen\('home'\)/);
  assert.match(hookSource, /focusWorkspace\(\)/);

  assert.match(appSource, /import \{[\s\S]*?useEcommerceMobileContinuationRuntime[\s\S]*?\} from '\.\/app\/useEcommerceMobileContinuationRuntime';/);
  assert.match(appSource, /const \{[\s\S]*?handleMobileEditEcommerceTask,[\s\S]*?handleMobileToggleEcommerceSelected,[\s\S]*?handleMobileConfirmEcommerceDesktop,[\s\S]*?handleMobileGenerateEcommerceMobile,[\s\S]*?\} = useEcommerceMobileContinuationRuntime\(\{/);
  assert.doesNotMatch(appSource, /const resolveMobileResultPromptNode = useCallback/);
  assert.doesNotMatch(appSource, /const handleMobileEditEcommerceTask = useCallback/);
  assert.doesNotMatch(appSource, /const handleMobileToggleEcommerceSelected = useCallback/);
  assert.doesNotMatch(appSource, /const handleMobileConfirmEcommerceDesktop = useCallback/);
  assert.doesNotMatch(appSource, /const handleMobileGenerateEcommerceMobile = useCallback/);

  assert.match(mobileWorkspaceSource, /onEditEcommerceTask:/);
  assert.match(mobileWorkspaceSource, /onConfirmEcommerceDesktop:/);
  assert.match(mobileWorkspaceSource, /onGenerateEcommerceMobile:/);
  assert.match(mobileWorkspaceSource, /onToggleEcommerceSelected:/);
});
