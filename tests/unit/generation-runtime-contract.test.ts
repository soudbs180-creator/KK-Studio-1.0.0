import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

describe('generation runtime extraction contract', () => {
  test('cancel generation ownership lives in useGenerationRuntime', () => {
    const hookPath = path.join(ROOT_DIR, 'src/app/useGenerationRuntime.ts');
    assert.equal(existsSync(hookPath), true, 'src/app/useGenerationRuntime.ts should exist');

    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const appSource = readSource('src/App.tsx');

    assert.match(hookSource, /interface UseGenerationRuntimeDeps \{/);
    assert.match(hookSource, /interface UseGenerationRuntimeResult \{/);
    assert.match(hookSource, /handleCancelGeneration: \(id\?: string\) => Promise<void>;/);
    assert.match(hookSource, /const handleCancelGeneration = useCallback\(async \(id\?: string\) => \{/);
    assert.match(hookSource, /const promptNodes = activeCanvas\?\.promptNodes \?\? \[\];/);
    assert.ok(hookSource.includes('cancelGenerationRequest(`${node.id}-${i}`);'));
    assert.match(hookSource, /await cancelSystemProxyTask\(node\.jobId\)/);
    assert.match(hookSource, /buildCancelledPromptNodePatch\(node\.model\)/);

    assert.match(appSource, /import \{ useGenerationRuntime \} from '\.\/app\/useGenerationRuntime';/);
    assert.match(appSource, /const \{[\s\S]*?handleCancelGeneration,[\s\S]*?\} = useGenerationRuntime\(\{/);
    assert.match(appSource, /cancelGenerationRequest: cancelGeneration,/);
    assert.match(appSource, /cancelSystemProxyTask: cancelSecureSystemProxyTask,/);
    assert.doesNotMatch(appSource, /const handleCancelGeneration = useCallback\(async \(id\?: string\) => \{/);
    assert.doesNotMatch(appSource, /buildCancelledPromptNodePatch\(node\.model\)/);
  });

  test('generation submit guard owns cooldown and duplicate signature state outside App', () => {
    const guardPath = path.join(ROOT_DIR, 'src/app/useGenerationSubmitGuard.ts');

    assert.equal(existsSync(guardPath), true);

    const appSource = readSource('src/App.tsx');
    const guardSource = readSource('src/app/useGenerationSubmitGuard.ts');

    assert.match(appSource, /from '\.\/app\/useGenerationSubmitGuard';/);
    assert.match(appSource, /const \{ tryStartGenerationSubmission \} = useGenerationSubmitGuard\(\);/);
    assert.match(appSource, /const submitGuard = tryStartGenerationSubmission\(\{/);
    assert.match(appSource, /if \(!submitGuard\.allowed\) return;/);

    assert.doesNotMatch(appSource, /const GENERATE_TRIGGER_COOLDOWN_MS =/);
    assert.doesNotMatch(appSource, /const GENERATE_SIGNATURE_DEDUP_MS =/);
    assert.doesNotMatch(appSource, /lastGenerateAtRef = useRef/);
    assert.doesNotMatch(appSource, /lastGenerateSignatureRef = useRef/);
    assert.doesNotMatch(appSource, /lastSignature\.value === submitSignature/);

    assert.match(guardSource, /const GENERATE_TRIGGER_COOLDOWN_MS = 500;/);
    assert.match(guardSource, /const GENERATE_SIGNATURE_DEDUP_MS = 4000;/);
    assert.match(guardSource, /export interface UseGenerationSubmitGuardDeps \{/);
    assert.match(guardSource, /export interface UseGenerationSubmitGuardResult \{/);
    assert.match(guardSource, /export function useGenerationSubmitGuard/);
    assert.match(guardSource, /const lastGenerateAtRef = useRef\(0\);/);
    assert.match(guardSource, /const lastGenerateSignatureRef = useRef<\{ value: string; at: number \} \| null>\(null\);/);
    assert.match(guardSource, /const submitSignature = JSON\.stringify\(\{/);
    assert.match(guardSource, /lastSignature\.value === submitSignature/);
    assert.match(guardSource, /notify\.warning\('已拦截重复发送'/);
  });

  test('generation billing helpers are owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');

    assert.match(hookSource, /ensureCreditAttemptCharged: \(params: EnsureCreditAttemptChargedParams\) => Promise<EnsureCreditAttemptChargedResult>;/);
    assert.match(hookSource, /resolveFailedCreditAttempt: \(node: GenerationCreditAttemptNode\) => Promise<GenerationCreditAttemptFailurePatch>;/);
    assert.match(hookSource, /applyOptimisticServerCreditDebit: \(requiredCredits: number, useServerSideCreditSettlement: boolean\) => void;/);
    assert.match(hookSource, /const ensureCreditAttemptCharged = useCallback\(async \(params: EnsureCreditAttemptChargedParams\)/);
    assert.match(hookSource, /const resolveFailedCreditAttempt = useCallback\(async \(node: GenerationCreditAttemptNode\)/);
    assert.match(hookSource, /const applyOptimisticServerCreditDebit = useCallback\(\(requiredCredits: number, useServerSideCreditSettlement: boolean\)/);
    assert.match(hookSource, /resolveGenerationAttemptFailureState\(node, \{/);
    assert.match(hookSource, /refundCreditsByTransaction,/);
    assert.match(hookSource, /refreshBilling,/);
    assert.match(hookSource, /adjustBalanceOptimistically\(-requiredCredits\)/);

    assert.match(appSource, /ensureCreditAttemptCharged,[\s\S]*?resolveFailedCreditAttempt,[\s\S]*?applyOptimisticServerCreditDebit,/);
    assert.match(appSource, /consumeCreditsDetailed,/);
    assert.match(appSource, /refundCreditsByTransaction,/);
    assert.match(appSource, /refreshBilling,/);
    assert.match(appSource, /adjustBalanceOptimistically,/);
    assert.doesNotMatch(appSource, /const ensureCreditAttemptCharged = useCallback\(async/);
    assert.doesNotMatch(appSource, /const resolveFailedCreditAttempt = useCallback\(async/);
    assert.doesNotMatch(appSource, /const applyOptimisticServerCreditDebit = useCallback\(/);
    assert.doesNotMatch(appSource, /resolveGenerationAttemptFailureState\(node, \{/);
  });

  test('initial generation credit settlement is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');

    assert.match(hookSource, /prepareInitialCreditSettlement: \(params: PrepareInitialCreditSettlementParams\) => Promise<PrepareInitialCreditSettlementResult>;/);
    assert.match(hookSource, /const prepareInitialCreditSettlement = useCallback\(async \(params: PrepareInitialCreditSettlementParams\)/);
    assert.match(hookSource, /if \(!params\.isCreditModel\) \{/);
    assert.match(hookSource, /notify\.error\('请先登录', '管理员配置的积分模型需要登录账号后使用积分调用。'\)/);
    assert.match(hookSource, /const chargeAttempt = await ensureCreditAttemptCharged\(\{/);
    assert.match(hookSource, /paymentTransactionId: chargeAttempt\.transactionId,/);

    assert.match(appSource, /const initialCreditSettlement = await prepareInitialCreditSettlement\(\{/);
    assert.match(appSource, /if \(!initialCreditSettlement\.allowed\) \{/);
    assert.match(appSource, /paymentTransactionId = initialCreditSettlement\.paymentTransactionId;/);
    assert.doesNotMatch(appSource, /if \(generationBillingState\.isCreditModel\) \{\s*if \(authLoading\)/);
    assert.doesNotMatch(appSource, /const chargeAttempt = await ensureCreditAttemptCharged\(\{\s*modelId: config\.model,/);
  });

  test('initial generation draft context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');

    assert.match(hookSource, /prepareGenerationDraftContext: \(args: PrepareGenerationDraftContextArgs\) => PrepareGenerationDraftContextResult;/);
    assert.match(hookSource, /const createGenerationPromptNodeId = \(\) => `node_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(16\)\.slice\(2, 8\)\}`;/);
    assert.match(hookSource, /const prepareGenerationDraftContext = useCallback\(\(\{/);
    assert.match(hookSource, /const isFollowUp = !!activeSourceImage;/);
    assert.match(hookSource, /const existingPromptDraftId = String\(draftNodeId \|\| ''\)\.trim\(\);/);
    assert.match(hookSource, /activeCanvasRef\.current\?\.promptNodes\.find\(\(node\) => node\.id === existingPromptDraftId\)/);
    assert.match(hookSource, /const hasReusablePromptDraft = Boolean\(isFollowUp && existingPromptDraft\);/);

    assert.match(appSource, /const draftContext = prepareGenerationDraftContext\(\{/);
    assert.match(appSource, /let promptNodeId = draftContext\.promptNodeId;/);
    assert.match(appSource, /const isFollowUp = draftContext\.isFollowUp;/);
    assert.match(appSource, /const hasReusablePromptDraft = draftContext\.hasReusablePromptDraft;/);
    assert.doesNotMatch(appSource, /const existingPromptDraftId = String\(draftNodeId \|\| ''\)\.trim\(\);/);
    assert.doesNotMatch(appSource, /const existingPromptDraft = existingPromptDraftId/);
    assert.doesNotMatch(appSource, /let promptNodeId = hasReusablePromptDraft/);
  });

  test('initial generation billing attempt context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');

    assert.match(hookSource, /prepareInitialBillingAttemptContext: \(params: PrepareInitialBillingAttemptContextParams\) => PrepareInitialBillingAttemptContextResult;/);
    assert.match(hookSource, /const prepareInitialBillingAttemptContext = useCallback\(\(params: PrepareInitialBillingAttemptContextParams\)/);
    assert.match(hookSource, /const resolvedCreditRoute = params\.generationBillingState\.isCreditModel/);
    assert.match(hookSource, /adminModelService\.getCreditRouteSnapshot\(params\.modelId, params\.imageSize\)/);
    assert.match(hookSource, /const billingAttempt = buildGenerationBillingAttempt\(\{/);
    assert.match(hookSource, /nodeId: params\.promptNodeId,/);
    assert.match(hookSource, /phase: 'initial',/);
    assert.match(hookSource, /useServerSideCreditSettlement: params\.generationBillingState\.useServerSideCreditSettlement,/);

    assert.match(appSource, /const billingAttemptContext = prepareInitialBillingAttemptContext\(\{/);
    assert.match(appSource, /const resolvedCreditRoute = billingAttemptContext\.resolvedCreditRoute;/);
    assert.match(appSource, /const billingAttempt = billingAttemptContext\.billingAttempt;/);
    assert.match(appSource, /const useServerSideCreditSettlement = billingAttemptContext\.useServerSideCreditSettlement;/);
    assert.doesNotMatch(appSource, /const resolvedCreditRoute = generationBillingState\.isCreditModel/);
    assert.doesNotMatch(appSource, /adminModelService\.getCreditRouteSnapshot\(config\.model, config\.imageSize\)/);
    assert.doesNotMatch(appSource, /const billingAttempt = buildGenerationBillingAttempt\(\{/);
  });

  test('initial generation billing state context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');

    assert.match(hookSource, /prepareGenerationBillingStateContext: \(params: PrepareGenerationBillingStateContextParams\) => PrepareGenerationBillingStateContextResult;/);
    assert.match(hookSource, /const prepareGenerationBillingStateContext = useCallback\(\(params: PrepareGenerationBillingStateContextParams\)/);
    assert.match(hookSource, /localStorage\.getItem\('kk_model_customizations'\)/);
    assert.match(hookSource, /params\.hasExplicitModelRoute\(params\.config\.model\)/);
    assert.match(hookSource, /keyManager\.getNextKey\(params\.config\.model, preferredKeyIdForBilling\)/);
    assert.match(hookSource, /resolveGenerationBillingState\(\{/);
    assert.match(hookSource, /console\.log\('\[handleGenerate\] 计费检查'/);

    assert.match(appSource, /const billingStateContext = prepareGenerationBillingStateContext\(\{/);
    assert.match(appSource, /const selectedKeyForBilling = billingStateContext\.selectedKeyForBilling;/);
    assert.match(appSource, /const generationBillingState = billingStateContext\.generationBillingState;/);
    assert.doesNotMatch(appSource, /localStorage\.getItem\('kk_model_customizations'\)/);
    assert.doesNotMatch(appSource, /const selectedKeyForBilling = keyManager\.getNextKey\(config\.model, preferredKeyIdForBilling\);/);
    assert.doesNotMatch(appSource, /const generationBillingState = resolveGenerationBillingState\(\{/);
  });

  test('initial generating prompt node assembly is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');

    assert.match(hookSource, /prepareInitialGeneratingPromptNode: \(params: PrepareInitialGeneratingPromptNodeParams\) => PrepareInitialGeneratingPromptNodeResult;/);
    assert.match(hookSource, /const prepareInitialGeneratingPromptNode = useCallback\(\(params: PrepareInitialGeneratingPromptNodeParams\)/);
    assert.match(hookSource, /const generationPreviewState = resolveGenerationPreviewState\(\{/);
    assert.match(hookSource, /const generatingNode = buildGeneratingPromptNode\(\{/);
    assert.match(hookSource, /promptNodeId: params\.promptNodeId,/);
    assert.match(hookSource, /prompt: params\.rawPrompt,/);
    assert.match(hookSource, /paymentTransactionId: params\.paymentTransactionId,/);
    assert.match(hookSource, /billingMode: params\.generationBillingState\.isCreditModel \? 'credits' : 'currency',/);

    assert.match(appSource, /const initialGeneratingNode = prepareInitialGeneratingPromptNode\(\{/);
    assert.match(appSource, /const generatingNode = initialGeneratingNode\.generatingNode;/);
    assert.doesNotMatch(appSource, /const generationPreviewState = resolveGenerationPreviewState\(\{/);
    assert.doesNotMatch(appSource, /const generatingNode = buildGeneratingPromptNode\(\{/);
  });

  test('initial generating prompt node persistence is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');

    assert.match(hookSource, /persistInitialGeneratingPromptNode: \(params: PersistInitialGeneratingPromptNodeParams\) => Promise<PersistInitialGeneratingPromptNodeResult>;/);
    assert.match(hookSource, /const persistInitialGeneratingPromptNode = useCallback\(async \(params: PersistInitialGeneratingPromptNodeParams\)/);
    assert.match(hookSource, /const persistedGeneratingNode = await persistGeneratingPromptNode\(\{/);
    assert.match(hookSource, /generatingNode: params\.generatingNode,/);
    assert.match(hookSource, /getCanvas: params\.getCanvas,/);
    assert.match(hookSource, /updatePromptNode,/);
    assert.match(hookSource, /addPromptNode: params\.addPromptNode,/);
    assert.match(hookSource, /updateImageNodePosition: params\.updateImageNodePosition,/);
    assert.match(hookSource, /deletePromptNode: params\.deletePromptNode,/);

    assert.match(appSource, /const persistedGeneration = await persistInitialGeneratingPromptNode\(\{/);
    assert.match(appSource, /const persistedGeneratingNode = persistedGeneration\.persistedGeneratingNode;/);
    assert.doesNotMatch(appSource, /const persistedGeneratingNode = await persistGeneratingPromptNode\(\{/);
  });

  test('initial prompt optimization context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');

    assert.match(hookSource, /prepareInitialGenerationPromptOptimization: \(params: PrepareInitialGenerationPromptOptimizationParams\) => Promise<PrepareInitialGenerationPromptOptimizationResult>;/);
    assert.match(hookSource, /const prepareInitialGenerationPromptOptimization = useCallback\(async \(params: PrepareInitialGenerationPromptOptimizationParams\)/);
    assert.match(hookSource, /return optimizeGenerationPrompt\(\{/);
    assert.match(hookSource, /enabled: \(params\.config\.mode === GenerationMode\.IMAGE \|\| params\.config\.mode === GenerationMode\.PPT\)\s*&& params\.config\.enablePromptOptimization/);
    assert.match(hookSource, /referenceImages: params\.finalReferenceImages,/);
    assert.match(hookSource, /supportsThinking: !!getModelCapabilities\(params\.config\.model\)\?\.supportsThinking,/);
    assert.match(hookSource, /notify\.error\('Prompt optimization failed'/);

    assert.match(appSource, /const initialPromptOptimization = await prepareInitialGenerationPromptOptimization\(\{/);
    assert.match(appSource, /const optimizedPromptEn = initialPromptOptimization\.optimizedPromptEn;/);
    assert.doesNotMatch(appSource, /enabled: \(config\.mode === GenerationMode\.IMAGE \|\| config\.mode === GenerationMode\.PPT\)/);
    assert.doesNotMatch(appSource, /supportsThinking: !!getModelCapabilities\(config\.model\)\?\.supportsThinking,/);
  });

  test('initial post-persist prompt cleanup is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');

    assert.match(hookSource, /completeInitialGenerationPromptSubmission: \(params: CompleteInitialGenerationPromptSubmissionParams\) => void;/);
    assert.match(hookSource, /const completeInitialGenerationPromptSubmission = useCallback\(\(params: CompleteInitialGenerationPromptSubmissionParams\)/);
    assert.match(hookSource, /params\.setDraftNodeId\(null\);/);
    assert.match(hookSource, /params\.setConfig\(prev => \(\{ \.\.\.prev, prompt: '', referenceImages: \[\] \}\)\);/);
    assert.match(hookSource, /params\.setActiveSourceImage\(null\);/);

    assert.match(appSource, /completeInitialGenerationPromptSubmission\(\{/);
    assert.match(appSource, /setDraftNodeId,/);
    assert.match(appSource, /setConfig,/);
    assert.match(appSource, /setActiveSourceImage,/);
    assert.doesNotMatch(
      appSource,
      /setDraftNodeId\(null\); \/\/ Detach status NOW[\s\S]*setConfig\(prev => \(\{ \.\.\.prev, prompt: '', referenceImages: \[\] \}\)\);[\s\S]*setActiveSourceImage\(null\);/,
    );
  });

  test('retry generation failure commit is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /commitRetryGenerationFailure: \(params: CommitRetryGenerationFailureParams\) => Promise<void>;/);
    assert.match(hookSource, /const commitRetryGenerationFailure = useCallback\(async \(params: CommitRetryGenerationFailureParams\)/);
    assert.match(hookSource, /const failedBillingState = await resolveFailedCreditAttempt\(params\.executionNode\);/);
    assert.match(hookSource, /await updatePromptNode\(\{/);
    assert.match(hookSource, /\.\.\.params\.executionNode,/);
    assert.match(hookSource, /error: errorMessage,/);
    assert.match(hookSource, /errorDetails: params\.extractErrorDetails\(params\.error, params\.executionNode\.model\),/);
    assert.match(hookSource, /notify\.error\('重试失败', notifyMessage\);/);

    assert.match(appSource, /await commitRetryGenerationFailure\(\{/);
    assert.match(appSource, /executionNode,/);
    assert.match(appSource, /extractErrorDetails,/);
    assert.doesNotMatch(retryNodeSource, /const failedBillingState = await resolveFailedCreditAttempt\(executionNode\);/);
    assert.doesNotMatch(retryNodeSource, /notify\.error\('重试失败', error\.message\);/);
  });
});
