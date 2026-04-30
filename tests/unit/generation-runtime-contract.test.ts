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

    assert.match(appSource, /import \{ useGenerationRuntime(?:, type RetryGeneratedMediaResultContext)? \} from '\.\/app\/useGenerationRuntime';/);
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

  test('initial generation execution kickoff is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');

    assert.match(hookSource, /executeInitialGenerationPromptNode: \(params: ExecuteInitialGenerationPromptNodeParams\) => Promise<void>;/);
    assert.match(hookSource, /const executeInitialGenerationPromptNode = useCallback\(async \(params: ExecuteInitialGenerationPromptNodeParams\)/);
    assert.match(hookSource, /applyOptimisticServerCreditDebit\(params\.requiredCredits, params\.useServerSideCreditSettlement\);/);
    assert.match(hookSource, /await params\.executeGeneration\(params\.persistedGeneratingNode\);/);

    assert.match(appSource, /await executeInitialGenerationPromptNode\(\{/);
    assert.match(appSource, /persistedGeneratingNode,/);
    assert.match(appSource, /requiredCredits,/);
    assert.match(appSource, /useServerSideCreditSettlement,/);
    assert.match(appSource, /executeGeneration,/);
    assert.doesNotMatch(
      appSource,
      /\/\/ Execute immediately after save completed\s*applyOptimisticServerCreditDebit\(requiredCredits, useServerSideCreditSettlement\);\s*await executeGeneration\(persistedGeneratingNode\);/,
    );
  });

  test('initial generation failure reporting is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('// Handle reference images'),
    );

    assert.match(hookSource, /reportInitialGenerationFailure: \(params: ReportInitialGenerationFailureParams\) => void;/);
    assert.match(hookSource, /const reportInitialGenerationFailure = useCallback\(\(params: ReportInitialGenerationFailureParams\)/);
    assert.match(hookSource, /console\.error\('\[handleGenerate\] failed:', params\.error\);/);
    assert.match(hookSource, /notify\.error\('发送失败', message\);/);
    assert.match(hookSource, /String\(\(params\.error as \{ message\?: unknown \} \| null \| undefined\)\?\.message \|\| '请重试'\)/);

    assert.match(handleGenerateSource, /reportInitialGenerationFailure\(\{ error: e \}\);/);
    assert.doesNotMatch(handleGenerateSource, /console\.error\('\[handleGenerate\] failed:', e\);/);
    assert.doesNotMatch(handleGenerateSource, /notify\.error\('发送失败', e\?\.message \|\| '请重试'\);/);
  });

  test('retry generation timeout guard is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /createRetryGenerationTimeoutGuard: \(params: CreateRetryGenerationTimeoutGuardParams\) => CreateRetryGenerationTimeoutGuardResult;/);
    assert.match(hookSource, /const createRetryGenerationTimeoutGuard = useCallback\(\(params: CreateRetryGenerationTimeoutGuardParams\)/);
    assert.match(hookSource, /const timer = setTimeout\(\(\) => \{/);
    assert.match(hookSource, /cancelGenerationRequest\(params\.requestId\);/);
    assert.match(hookSource, /void updatePromptNode\(\{/);
    assert.match(hookSource, /responseBody: `Retry request exceeded \$\{params\.timeoutMs\}ms timeout`,/);
    assert.match(hookSource, /markFinished: \(\) => \{/);
    assert.match(hookSource, /clear: \(\) => clearTimeout\(timer\),/);

    assert.match(retryNodeSource, /const timeoutGuard = createRetryGenerationTimeoutGuard\(\{/);
    assert.match(retryNodeSource, /requestId,/);
    assert.match(retryNodeSource, /timeoutMs: GENERATE_TIMEOUT_MS,/);
    assert.match(retryNodeSource, /timeoutGuard\.markFinished\(\);/);
    assert.match(retryNodeSource, /timeoutGuard\.clear\(\);/);
    assert.doesNotMatch(retryNodeSource, /const timer = setTimeout\(\(\) => \{/);
    assert.doesNotMatch(retryNodeSource, /cancelGeneration\(requestId\);/);
    assert.doesNotMatch(retryNodeSource, /Retry request exceeded 600000ms timeout/);
  });

  test('retry generation start commit is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /commitRetryGenerationStart: \(params: CommitRetryGenerationStartParams\) => void;/);
    assert.match(hookSource, /const commitRetryGenerationStart = useCallback\(\(params: CommitRetryGenerationStartParams\)/);
    assert.match(hookSource, /updatePromptNode\(\{/);
    assert.match(hookSource, /\.\.\.params\.executionNode,/);
    assert.match(hookSource, /modelLabel: params\.resolveModelDisplayName\(params\.executionNode\.model, params\.executionNode\.modelLabel \|\| params\.executionNode\.model\),/);
    assert.match(hookSource, /isGenerating: true,/);
    assert.match(hookSource, /timestamp: Date\.now\(\)/);
    assert.match(hookSource, /applyOptimisticServerCreditDebit\(\s*params\.retryBillingState\.requiredCredits,\s*params\.retryBillingState\.useServerSideCreditSettlement,\s*\);/);

    assert.match(retryNodeSource, /commitRetryGenerationStart\(\{/);
    assert.match(retryNodeSource, /executionNode,/);
    assert.match(retryNodeSource, /retryBillingState,/);
    assert.match(retryNodeSource, /resolveModelDisplayName,/);
    assert.doesNotMatch(
      retryNodeSource,
      /\/\/ 1\. Reset state to generating[\s\S]*?updatePromptNode\(\{[\s\S]*?applyOptimisticServerCreditDebit\(/,
    );
  });

  test('retry recovery notification is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /reportRetryRecoveryResult: \(params: ReportRetryRecoveryResultParams\) => void;/);
    assert.match(hookSource, /const reportRetryRecoveryResult = useCallback\(\(params: ReportRetryRecoveryResultParams\)/);
    assert.match(hookSource, /if \(params\.recoveredCount <= 0 && params\.pendingCount <= 0\) \{/);
    assert.match(hookSource, /const message = params\.pendingCount > 0/);
    assert.match(hookSource, /notify\.info\('恢复历史结果', message\);/);

    assert.match(retryNodeSource, /reportRetryRecoveryResult\(\{ recoveredCount: recovered\.recoveredCount, pendingCount: recovered\.pendingCount \}\);/);
    assert.doesNotMatch(retryNodeSource, /notify\.info\('恢复历史结果', message\);/);
    assert.doesNotMatch(retryNodeSource, /已重新接管 \$\{recovered\.pendingCount\}/);
  });

  test('retry generation request context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /prepareRetryGenerationRequestContext: \(params: PrepareRetryGenerationRequestContextParams\) => PrepareRetryGenerationRequestContextResult;/);
    assert.match(hookSource, /const prepareRetryGenerationRequestContext = useCallback\(\(params: PrepareRetryGenerationRequestContextParams\)/);
    assert.match(hookSource, /const currentNodeId = params\.node\.id;/);
    assert.match(hookSource, /const requestedCount = params\.node\.parallelCount \|\| params\.defaultParallelCount \|\| 1;/);
    assert.match(hookSource, /const count = params\.node\.mode === GenerationMode\.PPT \? Math\.min\(20, Math\.max\(1, requestedCount\)\) : requestedCount;/);

    assert.match(retryNodeSource, /const \{ currentNodeId, count \} = prepareRetryGenerationRequestContext\(\{/);
    assert.match(retryNodeSource, /defaultParallelCount: config\.parallelCount,/);
    assert.doesNotMatch(retryNodeSource, /const currentNodeId = node\.id;/);
    assert.doesNotMatch(retryNodeSource, /const requestedCount = node\.parallelCount \|\| config\.parallelCount \|\| 1;/);
    assert.doesNotMatch(retryNodeSource, /const count = node\.mode === GenerationMode\.PPT \? Math\.min\(20, Math\.max\(1, requestedCount\)\) : requestedCount;/);
  });

  test('retry generation success side effects are owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /reportRetryGenerationSuccess: \(params: ReportRetryGenerationSuccessParams\) => void;/);
    assert.match(hookSource, /const reportRetryGenerationSuccess = useCallback\(\(params: ReportRetryGenerationSuccessParams\)/);
    assert.match(hookSource, /const effectiveSize = params\.alignedImageNodes\[0\]\?\.imageSize \|\| params\.executionNode\.imageSize;/);
    assert.match(hookSource, /import\('\.\.\/services\/billing\/costService'\)\.then\(\(\{ recordCost \}\) => \{/);
    assert.match(hookSource, /recordCost\(/);
    assert.match(hookSource, /notify\.success\('生成完成', '重新生成成功'\);/);

    assert.match(retryNodeSource, /reportRetryGenerationSuccess\(\{[\s\S]*executionNode,[\s\S]*alignedImageNodes,[\s\S]*results,[\s\S]*\}\);/);
    assert.doesNotMatch(retryNodeSource, /const effectiveSize = alignedImageNodes\[0\]\?\.imageSize \|\| executionNode\.imageSize;/);
    assert.doesNotMatch(retryNodeSource, /import\('\.\/services\/billing\/costService'\)/);
    assert.doesNotMatch(retryNodeSource, /notify\.success\('生成完成', '重新生成成功'\);/);
  });

  test('retry generation task prompt context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /prepareRetryGenerationTaskPromptContext: \(params: PrepareRetryGenerationTaskPromptContextParams\) => PrepareRetryGenerationTaskPromptContextResult;/);
    assert.match(hookSource, /const prepareRetryGenerationTaskPromptContext = useCallback\(\(params: PrepareRetryGenerationTaskPromptContextParams\)/);
    assert.match(hookSource, /const currentMode = params\.executionNode\.mode \|\| GenerationMode\.IMAGE;/);
    assert.match(hookSource, /const slideLines = \(params\.executionNode\.pptSlides \|\| \[\]\)[\s\S]*?\.map/);
    assert.match(hookSource, /params\.executionNode\.pptStyleLocked !== false/);
    assert.match(hookSource, /PPT 第 \$\{params\.index \+ 1\}\/\$\{params\.count\} 页/);

    assert.match(retryNodeSource, /const \{ currentMode, taskPrompt \} = prepareRetryGenerationTaskPromptContext\(\{/);
    assert.match(retryNodeSource, /sourcePrompt: node\.prompt,/);
    assert.doesNotMatch(retryNodeSource, /const currentMode: GenerationMode = executionNode\.mode \|\| GenerationMode\.IMAGE;/);
    assert.doesNotMatch(retryNodeSource, /const taskPrompt = currentMode === GenerationMode\.PPT/);
    assert.doesNotMatch(retryNodeSource, /const styleDirective = executionNode\.pptStyleLocked !== false/);
  });

  test('retry video generation request options are owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /prepareRetryVideoGenerationRequest: \(params: PrepareRetryVideoGenerationRequestParams\) => PrepareRetryVideoGenerationRequestResult;/);
    assert.match(hookSource, /const prepareRetryVideoGenerationRequest = useCallback\(\(params: PrepareRetryVideoGenerationRequestParams\)/);
    assert.match(hookSource, /if \(params\.executionNode\.videoResolution\) return params\.executionNode\.videoResolution;/);
    assert.match(hookSource, /const size = params\.executionNode\.imageSize\?\.toLowerCase\(\) \|\| '';/);
    assert.match(hookSource, /const videoAspect = params\.executionNode\.aspectRatio === '9:16' \? '9:16' : '16:9';/);
    assert.match(hookSource, /providerConfig: \{[\s\S]*google: \{[\s\S]*imageConfig: \{ imageSize: videoResolution \}[\s\S]*\}[\s\S]*\}/);

    assert.match(retryNodeSource, /const videoRequest = prepareRetryVideoGenerationRequest\(\{ executionNode, taskPrompt \}\);/);
    assert.match(retryNodeSource, /const videoResult = await llmService\.generateVideo\(videoRequest\);/);
    assert.doesNotMatch(retryNodeSource, /const videoResolution = \(\(\) => \{/);
    assert.doesNotMatch(retryNodeSource, /const videoAspect = executionNode\.aspectRatio === '9:16' \? '9:16' : '16:9';/);
    assert.doesNotMatch(retryNodeSource, /providerConfig: \{[\s\S]*google: \{[\s\S]*imageConfig: \{ imageSize: videoResolution \}/);
  });

  test('retry video generation result normalization is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /buildRetryVideoGenerationResultContext: \(params: BuildRetryVideoGenerationResultContextParams\) => BuildRetryVideoGenerationResultContextResult;/);
    assert.match(hookSource, /const buildRetryVideoGenerationResultContext = useCallback\(\(\s*params: BuildRetryVideoGenerationResultContextParams,\s*\): BuildRetryVideoGenerationResultContextResult => \{/);
    assert.match(hookSource, /const usage = params\.videoResult\.usage as/);
    assert.match(hookSource, /b64: params\.videoResult\.url,/);
    assert.match(hookSource, /keySlotId: params\.videoResult\.keySlotId \|\| params\.executionNode\.keySlotId,/);
    assert.match(hookSource, /costSource: cost !== undefined \? 'explicit' : 'none',/);

    assert.match(retryNodeSource, /generatedMediaContext = buildRetryVideoGenerationResultContext\(\{/);
    assert.match(retryNodeSource, /videoResult,/);
    assert.match(retryNodeSource, /const \{ apiDurationMs, b64, requestTrace, resultMetadata \} = generatedMediaContext;/);
    assert.doesNotMatch(retryNodeSource, /actualKeySlotId = videoResult\.keySlotId \|\| actualKeySlotId;/);
    assert.doesNotMatch(retryNodeSource, /actualProvider = videoResult\.provider \|\| actualProvider;/);
    assert.doesNotMatch(retryNodeSource, /\(videoResult as any\)\.usage\?\.cost/);
  });

  test('retry image generation request options are owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /prepareRetryImageGenerationRequest: \(params: PrepareRetryImageGenerationRequestParams\) => PrepareRetryImageGenerationRequestResult;/);
    assert.match(hookSource, /const prepareRetryImageGenerationRequest = useCallback\(\(params: PrepareRetryImageGenerationRequestParams\)/);
    assert.match(hookSource, /grounding: !!params\.executionNode\.enableGrounding \|\| !!params\.executionNode\.enableImageSearch,/);
    assert.match(hookSource, /preferredKeyId: params\.executionNode\.keySlotId,/);
    assert.match(hookSource, /enableWebSearch: !!params\.executionNode\.enableGrounding,/);
    assert.match(hookSource, /thinkingMode: params\.executionNode\.thinkingMode \|\| 'minimal'/);

    assert.match(retryNodeSource, /const imageRequest = prepareRetryImageGenerationRequest\(\{ executionNode, requestId, taskPrompt \}\);/);
    assert.match(retryNodeSource, /const result = await generateImage\([\s\S]*\.\.\.imageRequest\.args,[\s\S]*imageRequest\.grounding,[\s\S]*imageRequest\.options,[\s\S]*\);/);
    assert.doesNotMatch(retryNodeSource, /!!executionNode\.enableGrounding \|\| !!executionNode\.enableImageSearch/);
    assert.doesNotMatch(retryNodeSource, /preferredKeyId: executionNode\.keySlotId/);
    assert.doesNotMatch(retryNodeSource, /thinkingMode: executionNode\.thinkingMode \|\| 'minimal'/);
  });

  test('retry image generation result normalization is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /buildRetryImageGenerationResultContext: \(params: BuildRetryImageGenerationResultContextParams\) => BuildRetryImageGenerationResultContextResult;/);
    assert.match(hookSource, /const buildRetryImageGenerationResultContext = useCallback\(\(\s*params: BuildRetryImageGenerationResultContextParams,\s*\): BuildRetryImageGenerationResultContextResult => \{/);
    assert.match(hookSource, /b64: params\.result\.url,/);
    assert.match(hookSource, /apiDurationMs: params\.result\.apiDurationMs,/);
    assert.match(hookSource, /const model = params\.result\.effectiveModel \|\| params\.executionNode\.model;/);
    assert.match(hookSource, /model,/);
    assert.match(hookSource, /modelLabel: params\.resolveModelDisplayName\(/);
    assert.match(hookSource, /balanceAfter: params\.result\.balanceAfter,/);

    assert.match(retryNodeSource, /generatedMediaContext = buildRetryImageGenerationResultContext\(\{/);
    assert.match(retryNodeSource, /resolveModelDisplayName,/);
    assert.match(retryNodeSource, /const \{ apiDurationMs, b64, requestTrace, resultMetadata \} = generatedMediaContext;/);
    assert.match(retryNodeSource, /if \(typeof generatedMediaContext\.balanceAfter === 'number'\) \{/);
    assert.match(retryNodeSource, /applyAuthoritativeBalance\(generatedMediaContext\.balanceAfter\);/);
    assert.doesNotMatch(retryNodeSource, /actualProvider = result\.provider \|\| actualProvider;/);
    assert.doesNotMatch(retryNodeSource, /actualModel = result\.effectiveModel \|\| actualModel;/);
    assert.doesNotMatch(retryNodeSource, /actualCost = typeof result\.cost === 'number'/);
  });

  test('retry generated media result context is consolidated before result assembly', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /export interface RetryGeneratedMediaResultContext \{/);
    assert.match(hookSource, /requestTrace: RetryGenerationSuccessDebugResult;/);
    assert.match(hookSource, /resultMetadata: RetryGeneratedMediaResultMetadata;/);

    assert.match(appSource, /import \{ useGenerationRuntime, type RetryGeneratedMediaResultContext \} from '\.\/app\/useGenerationRuntime';/);
    assert.match(retryNodeSource, /let generatedMediaContext: RetryGeneratedMediaResultContext;/);
    assert.match(retryNodeSource, /generatedMediaContext = buildRetryVideoGenerationResultContext\(\{/);
    assert.match(retryNodeSource, /generatedMediaContext = buildRetryImageGenerationResultContext\(\{/);
    assert.match(retryNodeSource, /const \{ apiDurationMs, b64, requestTrace, resultMetadata \} = generatedMediaContext;/);
    assert.match(retryNodeSource, /requestTrace,/);
    assert.match(retryNodeSource, /resultMetadata,/);

    assert.doesNotMatch(retryNodeSource, /let b64 = '';/);
    assert.doesNotMatch(retryNodeSource, /let requestPath: string \| undefined = undefined;/);
    assert.doesNotMatch(retryNodeSource, /let actualKeySlotId = executionNode\.keySlotId;/);
    assert.doesNotMatch(retryNodeSource, /requestTrace: \{ requestPath, requestBodyPreview, pythonSnippet \}/);
    assert.doesNotMatch(retryNodeSource, /resultMetadata: \{[\s\S]*actualKeySlotId[\s\S]*\}/);
  });

  test('retry generated media persistence context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /prepareRetryGeneratedMediaPersistence: \(params: PrepareRetryGeneratedMediaPersistenceParams\) => Promise<PrepareRetryGeneratedMediaPersistenceResult>;/);
    assert.match(hookSource, /const prepareRetryGeneratedMediaPersistence = useCallback/);
    assert.match(hookSource, /Promise<PrepareRetryGeneratedMediaPersistenceResult> => \{/);
    assert.match(hookSource, /const normalizedOriginalSource = params\.normalizePersistableMediaSource\(/);
    assert.match(hookSource, /const storageId = await params\.calculateImageHash\(normalizedOriginalSource \|\| url\);/);
    assert.match(hookSource, /void params\.saveOriginalImage\(storageId, normalizedOriginalSource\)\.catch\(\(\) => undefined\);/);
    assert.match(hookSource, /const mimeType = params\.currentMode === GenerationMode\.VIDEO \? 'video\/mp4' : 'image\/png';/);

    assert.match(retryNodeSource, /const mediaPersistence = await prepareRetryGeneratedMediaPersistence\(\{/);
    assert.match(retryNodeSource, /normalizePersistableMediaSource,/);
    assert.match(retryNodeSource, /calculateImageHash,/);
    assert.match(retryNodeSource, /saveOriginalImage,/);
    assert.doesNotMatch(retryNodeSource, /const normalizedOriginalSource = normalizePersistableMediaSource\(/);
    assert.doesNotMatch(retryNodeSource, /const storageId = await calculateImageHash\(normalizedOriginalSource \|\| url\);/);
    assert.doesNotMatch(retryNodeSource, /void saveOriginalImage\(storageId, normalizedOriginalSource\)\.catch\(\(\) => undefined\);/);
  });

  test('retry generated media dimension detection is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /resolveRetryGeneratedMediaDimensions: \(params: ResolveRetryGeneratedMediaDimensionsParams\) => Promise<ResolveRetryGeneratedMediaDimensionsResult>;/);
    assert.match(hookSource, /const resolveRetryGeneratedMediaDimensions = useCallback/);
    assert.match(hookSource, /Promise<ResolveRetryGeneratedMediaDimensionsResult> => \{/);
    assert.match(hookSource, /let actualWidth = 1024;/);
    assert.match(hookSource, /const bitmap = await createImageBitmap\(blob\);/);
    assert.match(hookSource, /const maxDim = Math\.max\(actualWidth, actualHeight\);/);
    assert.match(hookSource, /computedImageSize = ImageSize\.SIZE_4K;/);

    assert.match(retryNodeSource, /const mediaDimensions = await resolveRetryGeneratedMediaDimensions\(\{/);
    assert.match(retryNodeSource, /executionNode,/);
    assert.match(retryNodeSource, /url,/);
    assert.doesNotMatch(retryNodeSource, /let actualWidth = 1024;/);
    assert.doesNotMatch(retryNodeSource, /const bitmap = await createImageBitmap\(blob\);/);
    assert.doesNotMatch(retryNodeSource, /const maxDim = Math\.max\(actualWidth, actualHeight\);/);
  });

  test('retry generated media cloud sync scheduling is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /scheduleRetryGeneratedMediaCloudSync: \(params: ScheduleRetryGeneratedMediaCloudSyncParams\) => void;/);
    assert.match(hookSource, /const scheduleRetryGeneratedMediaCloudSync = useCallback\(\(params: ScheduleRetryGeneratedMediaCloudSyncParams\): void => \{/);
    assert.match(hookSource, /const shouldSyncImageMedia = params\.currentMode === GenerationMode\.IMAGE/);
    assert.match(hookSource, /\|\| params\.currentMode === GenerationMode\.PPT/);
    assert.match(hookSource, /\|\| params\.currentMode === GenerationMode\.ECOMMERCE;/);
    assert.match(hookSource, /if \(!shouldSyncImageMedia\) \{/);
    assert.match(hookSource, /if \(!params\.b64\.startsWith\('data:'\)\) \{/);
    assert.match(hookSource, /import\('\.\.\/services\/system\/syncService'\)\.then/);
    assert.match(hookSource, /await syncService\.uploadImagePair\(id, blob\);/);

    assert.match(retryNodeSource, /scheduleRetryGeneratedMediaCloudSync\(\{/);
    assert.match(retryNodeSource, /currentMode,/);
    assert.match(retryNodeSource, /index,/);
    assert.doesNotMatch(retryNodeSource, /import\('\.\/services\/system\/syncService'\)/);
    assert.doesNotMatch(retryNodeSource, /await syncService\.uploadImagePair\(id, blob\);/);
    assert.doesNotMatch(retryNodeSource, /Already captured in mediaPersistence for persisted result metadata/);
  });

  test('retry generated media result assembly is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /buildRetryGeneratedMediaResult: \(params: BuildRetryGeneratedMediaResultParams\) => RetryGeneratedMediaResult;/);
    assert.match(hookSource, /const buildRetryGeneratedMediaResult = useCallback\(\(params: BuildRetryGeneratedMediaResultParams\): RetryGeneratedMediaResult => \{/);
    assert.match(hookSource, /canvasId: params\.canvasId \|\| 'default',/);
    assert.match(hookSource, /dimensions: params\.mediaDimensions\.displayDimensions,/);
    assert.match(hookSource, /const sourceReferenceStorageIds = \(params\.executionNode\.referenceImages \|\| \[\]\)[\s\S]*\.map/);
    assert.match(hookSource, /id: `\$\{Date\.now\(\)\}_\$\{params\.index\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 5\)\}`/);
    assert.match(hookSource, /mimeType: params\.mediaPersistence\.mimeType,/);

    assert.match(retryNodeSource, /const generatedResult = buildRetryGeneratedMediaResult\(\{/);
    assert.match(retryNodeSource, /mediaDimensions,/);
    assert.match(retryNodeSource, /mediaPersistence,/);
    assert.match(retryNodeSource, /return generatedResult;/);
    assert.doesNotMatch(retryNodeSource, /sourceReferenceStorageIds: \(executionNode\.referenceImages \|\| \[\]\)\.map/);
    assert.doesNotMatch(retryNodeSource, /id: `\$\{Date\.now\(\)\}_\$\{index\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 5\)\}`/);
  });

  test('retry completed prompt patch assembly is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /buildRetryCompletedPromptPatch: \(params: BuildRetryCompletedPromptPatchParams\) => Partial<PromptNode>;/);
    assert.match(hookSource, /const buildRetryCompletedPromptPatch = useCallback\(\(params: BuildRetryCompletedPromptPatchParams\): Partial<PromptNode> => \{/);
    assert.match(hookSource, /childImageIds: params\.alignedImageNodes\.map\(n => n\.id\),/);
    assert.match(hookSource, /\.\.\.buildCompletedPromptNodePatch\(\),/);
    assert.match(hookSource, /modelLabel: params\.resolveModelDisplayName\(/);

    assert.match(retryNodeSource, /const retryCompletedPromptPatch = buildRetryCompletedPromptPatch\(\{/);
    assert.match(retryNodeSource, /addImageNodes\(alignedImageNodes, \{\s*\[node\.id\]: retryCompletedPromptPatch,\s*\}\);/);
    assert.doesNotMatch(retryNodeSource, /childImageIds: alignedImageNodes\.map\(n => n\.id\),/);
    assert.doesNotMatch(retryNodeSource, /\.\.\.buildCompletedPromptNodePatch\(\),/);
    assert.doesNotMatch(retryNodeSource, /modelLabel: resolveModelDisplayName\(/);
  });

  test('retry generated media layout preparation is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf('const handleExportPptPackage = useCallback'),
    );

    assert.match(hookSource, /buildRetryGeneratedMediaLayout: \(params: BuildRetryGeneratedMediaLayoutParams\) => RetryGeneratedMediaLayoutNode\[\];/);
    assert.match(hookSource, /const buildRetryGeneratedMediaLayout = useCallback\(\(params: BuildRetryGeneratedMediaLayoutParams\): RetryGeneratedMediaLayoutNode\[\] => \{/);
    assert.match(hookSource, /const newImageNodes = params\.results\.map\(\(img, i\) => \{/);
    assert.match(hookSource, /let exactImageHeight = cardHeight;/);
    assert.match(hookSource, /const generatedPositions = params\.buildGeneratedImageBatchPositions\(\{/);
    assert.match(hookSource, /basePosition: \(params\.latestLayoutPrompt \|\| params\.executionNode\)\.position \|\| params\.executionNode\.position,/);

    assert.match(retryNodeSource, /const latestLayoutPrompt = activeCanvasRef\.current\?\.promptNodes\.find/);
    assert.match(retryNodeSource, /const alignedImageNodes = buildRetryGeneratedMediaLayout\(\{/);
    assert.match(retryNodeSource, /buildGeneratedImageBatchPositions,/);
    assert.match(retryNodeSource, /getCardDimensions,/);
    assert.doesNotMatch(retryNodeSource, /const newImageNodes = results\.map\(\(img, i\) => \{/);
    assert.doesNotMatch(retryNodeSource, /let exactImageHeight = cardHeight;/);
    assert.doesNotMatch(retryNodeSource, /const generatedPositions = buildGeneratedImageBatchPositions\(\{/);
  });
});
