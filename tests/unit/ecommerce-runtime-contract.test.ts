import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce framework scheduler actions are owned by useEcommerceRuntime', () => {
  const hookPath = path.join(ROOT_DIR, 'src/app/useEcommerceRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceRuntime.ts');
  const slotHistoryHookSource = readSource('src/app/useEcommerceSlotHistoryRuntime.ts');

  assert.match(hookSource, /export interface UseEcommerceRuntimeDeps(?:<[\s\S]*?>)? \{/);
  assert.match(hookSource, /export interface UseEcommerceRuntimeResult \{/);
  assert.match(hookSource, /handleGenerateEcommerceFramework: \(node: PromptNode\) => Promise<void>;/);
  assert.match(hookSource, /handleGenerateEcommerceGroup: \(node: PromptNode, phase: 'desktop' \| 'mobile'\) => Promise<void>;/);
  assert.match(hookSource, /handleToggleEcommerceAnalysisSelection: \(id: string, selected: boolean\) => void;/);
  assert.match(hookSource, /handleToggleEcommerceSelected: \(node: PromptNode, selected: boolean\) => void;/);
  assert.match(hookSource, /handleSetEcommerceGroupSelection: \(groupNode: PromptNode, selected: boolean\) => void;/);
  assert.match(slotHistoryHookSource, /export interface UseEcommerceSlotHistoryRuntimeDeps \{/);
  assert.match(slotHistoryHookSource, /export interface UseEcommerceSlotHistoryRuntimeResult \{/);
  assert.match(slotHistoryHookSource, /resolveEcommerceSlotState: \(node: PromptNode\) => EcommerceGroupSlotState \| null;/);
  assert.match(slotHistoryHookSource, /handlePreviewEcommerceSlotHistory: \(\s*sourceSheet: EcommerceGroupSheet,\s*sourceKey: string,\s*preferredImageId\?: string,\s*\) => void;/);
  assert.match(slotHistoryHookSource, /handlePreviewEcommerceSlotHistoryForNode: \(node: PromptNode, preferredImageId\?: string\) => void;/);
  assert.match(hookSource, /enqueueEcommerceFrameworkNodes: \(/);
  assert.match(hookSource, /pumpEcommerceFrameworkQueue: \(frameworkId: string\) => void;/);
  assert.match(hookSource, /cancelEcommerceFrameworkNodeQueue/);
  assert.match(hookSource, /resolveEcommerceFrameworkDispatchPlan/);
  assert.match(hookSource, /resolveFrameworkLane/);

  assert.match(appSource, /import \{ useEcommerceRuntime, type UpdateEcommerceSelectionState \} from '\.\/app\/useEcommerceRuntime';/);
  assert.match(appSource, /import \{[\s\S]*?useEcommerceNodeGenerationRuntime,[\s\S]*?\} from '\.\/app\/useEcommerceNodeGenerationRuntime';/);
  assert.match(appSource, /import \{ useEcommerceFrameworkRuntimeState,[\s\S]*?\} from '\.\/app\/useEcommerceFrameworkRuntimeState';/);
  assert.match(appSource, /import \{ useEcommerceSlotHistoryRuntime \} from '\.\/app\/useEcommerceSlotHistoryRuntime';/);
  assert.match(appSource, /const \{[\s\S]*?handleGenerateEcommerceNode,[\s\S]*?handleConfirmEcommerceDesktop,[\s\S]*?handleRetryEcommerceModule,[\s\S]*?\} = useEcommerceNodeGenerationRuntime\(\{/);
  assert.match(appSource, /const \{[\s\S]*?handleGenerateEcommerceFramework,[\s\S]*?handleGenerateEcommerceGroup,[\s\S]*?handleToggleEcommerceAnalysisSelection,[\s\S]*?handleToggleEcommerceSelected,[\s\S]*?handleSetEcommerceGroupSelection,[\s\S]*?\} = useEcommerceRuntime\(\{/);
  assert.match(appSource, /const frameworkStateView = useEcommerceFrameworkRuntimeState\(\{/);
  assert.match(appSource, /const \{[\s\S]*?resolveEcommerceSlotState,[\s\S]*?handlePreviewEcommerceSlotHistory,[\s\S]*?handlePreviewEcommerceSlotHistoryForNode,[\s\S]*?\} = useEcommerceSlotHistoryRuntime\(\{/);
  assert.match(appSource, /frameworkStateView,/);
  assert.match(appSource, /updateEcommerceSelectionState,/);
  assert.match(appSource, /updateEcommerceNodeState,/);
  assert.match(appSource, /setWorkspaceSurface,/);
  assert.match(appSource, /setPreviewImages,/);
  assert.match(appSource, /setPreviewInitialIndex,/);
  assert.match(appSource, /handleGenerateEcommerceNode,/);
  assert.match(appSource, /handleRetryEcommerceModule,/);

  assert.doesNotMatch(appSource, /const resolveEcommerceFrameworkQueuePhases = useCallback/);
  assert.doesNotMatch(appSource, /const enqueueEcommerceFrameworkNodes = useCallback/);
  assert.doesNotMatch(appSource, /const pumpEcommerceFrameworkQueue = useCallback/);
  assert.doesNotMatch(appSource, /const handleGenerateEcommerceFramework = useCallback/);
  assert.doesNotMatch(appSource, /const handlePauseEcommerceFramework = useCallback/);
  assert.doesNotMatch(appSource, /const handleResumeEcommerceFramework = useCallback/);
  assert.doesNotMatch(appSource, /const handleCancelEcommerceFrameworkNodeQueue = useCallback/);
  assert.doesNotMatch(appSource, /const handleGenerateEcommerceGroup = useCallback/);
  assert.doesNotMatch(appSource, /const handleToggleEcommerceAnalysisSelection = useCallback/);
  assert.doesNotMatch(appSource, /const handleToggleEcommerceSelected = useCallback/);
  assert.doesNotMatch(appSource, /const handleSetEcommerceGroupSelection = useCallback/);
  assert.doesNotMatch(appSource, /const resolveEcommerceFrameworkId = useCallback/);
  assert.doesNotMatch(appSource, /const updateEcommerceFrameworkRuntime = useCallback/);
  assert.doesNotMatch(appSource, /const syncEcommerceFrameworkView = useCallback/);
  assert.doesNotMatch(appSource, /const resolveEcommerceSlotState = useCallback/);
  assert.doesNotMatch(appSource, /const handlePreviewEcommerceSlotHistory = useCallback/);
  assert.doesNotMatch(appSource, /const handlePreviewEcommerceSlotHistoryForNode = useCallback/);
});

test('ecommerce runtime queue warnings are localized for Chinese workspace', () => {
  const hookSource = readSource('src/app/useEcommerceRuntime.ts');

  assert.match(hookSource, /import \{ pickByDocumentLanguage \} from '\.\.\/utils\/localeText';/);
  assert.doesNotMatch(hookSource, /notify\.warning\('No eligible cards'/);
  assert.match(hookSource, /notify\.warning\(\s*pickByDocumentLanguage\([^)]*'No eligible cards'\)/);
  assert.match(hookSource, /pickByDocumentLanguage\([^)]*There are no ecommerce cards ready to enqueue\./);
  assert.match(hookSource, /pickByDocumentLanguage\([^)]*There are no confirmed mobile follow-up cards ready to enqueue\./);
  assert.match(hookSource, /pickByDocumentLanguage\([^)]*There are no ecommerce cards ready to enqueue for this group\./);
});
