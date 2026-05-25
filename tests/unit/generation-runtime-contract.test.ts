import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import type {
  CompleteRetryGeneratedMediaBatchParams,
  PrepareInitialGenerationSubmissionContextResult,
  RetryGeneratedMediaResultContext,
  UseGenerationRuntimeDeps,
  UseGenerationRuntimeResult,
} from '../../apps/web/src/app/useGenerationRuntime.ts';

const ROOT_DIR = process.cwd();
const APP_RETRY_NODE_END_MARKER = 'const {\n    updateEcommerceNodeState,';

type GenerationRuntimePublicBoundary = {
  deps: UseGenerationRuntimeDeps;
  result: UseGenerationRuntimeResult;
  initialSubmission: PrepareInitialGenerationSubmissionContextResult;
  retryContext: RetryGeneratedMediaResultContext;
  completeRetryBatch: CompleteRetryGeneratedMediaBatchParams;
}



describe('generation runtime extraction contract', () => {
  test('generation runtime public boundary types are semantically checked', () => {
    const generationRuntimeSource = readSource('src/app/useGenerationRuntime.ts');
    const testConfigSource = readSource('tsconfig.tests.json');
    const boundaryIsTypechecked: GenerationRuntimePublicBoundary | null = null;

    assert.equal(boundaryIsTypechecked, null);
    assert.match(generationRuntimeSource, /export interface UseGenerationRuntimeDeps \{/);
    assert.match(generationRuntimeSource, /export interface UseGenerationRuntimeResult \{/);
    assert.match(generationRuntimeSource, /export type PrepareInitialGenerationSubmissionContextResult =/);
    assert.match(generationRuntimeSource, /export interface RetryGeneratedMediaResultContext \{/);
    assert.match(generationRuntimeSource, /export interface CompleteRetryGeneratedMediaBatchParams extends Omit</);
    assert.match(testConfigSource, /tests\/unit\/generation-runtime-contract\.test\.ts/);
  });

  test('generation runtime receives model display names through deps only', () => {
    const hookSource = readSource('src/app/useGenerationRuntime.ts');

    assert.doesNotMatch(
      hookSource,
      /import\s+\{\s*resolveModelDisplayName\s*\}\s+from ['"]\.\.\/utils\/modelDisplayName['"];/,
    );
    assert.match(hookSource, /resolveModelDisplayName: \(modelId: string, fallbackLabel\?: string\) => string;/);
    assert.match(hookSource, /modelLabel: params\.resolveModelDisplayName\(/);
  });

  test('cancel generation ownership lives in useGenerationRuntime', () => {
    const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useGenerationRuntime.ts');
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
    const guardPath = path.join(ROOT_DIR, 'apps/web/src/app/useGenerationSubmitGuard.ts');

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

    assert.match(appSource, /consumeCreditsDetailed,/);
    assert.match(appSource, /refundCreditsByTransaction,/);
    assert.match(appSource, /refreshBilling,/);
    assert.match(appSource, /adjustBalanceOptimistically,/);
    assert.doesNotMatch(appSource, /\bensureCreditAttemptCharged\b/);
    assert.doesNotMatch(appSource, /\bresolveFailedCreditAttempt\b/);
    assert.doesNotMatch(appSource, /\bapplyOptimisticServerCreditDebit\b/);
    assert.doesNotMatch(appSource, /const ensureCreditAttemptCharged = useCallback\(async/);
    assert.doesNotMatch(appSource, /const resolveFailedCreditAttempt = useCallback\(async/);
    assert.doesNotMatch(appSource, /const applyOptimisticServerCreditDebit = useCallback\(/);
    assert.doesNotMatch(appSource, /resolveGenerationAttemptFailureState\(node, \{/);
  });

  test('initial generation credit settlement is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );
    const preflightSource = hookSource.slice(
      hookSource.indexOf('const prepareInitialGenerationSubmissionContext = useCallback'),
      hookSource.indexOf('const prepareInitialGeneratingPromptNode = useCallback'),
    );

    assert.match(hookSource, /prepareInitialCreditSettlement: \(params: PrepareInitialCreditSettlementParams\) => Promise<PrepareInitialCreditSettlementResult>;/);
    assert.match(hookSource, /const prepareInitialCreditSettlement = useCallback\(async \(params: PrepareInitialCreditSettlementParams\)/);
    assert.match(hookSource, /if \(!params\.isCreditModel\) \{/);
    assert.match(hookSource, /notify\.error\('请先登录', '管理员配置的积分模型需要登录账号后使用积分调用。'\)/);
    assert.match(hookSource, /const chargeAttempt = await ensureCreditAttemptCharged\(\{/);
    assert.match(hookSource, /paymentTransactionId: chargeAttempt\.transactionId,/);

    assert.match(preflightSource, /const initialCreditSettlement = await prepareInitialCreditSettlement\(\{/);
    assert.match(preflightSource, /if \(!initialCreditSettlement\.allowed\) \{/);
    assert.match(preflightSource, /paymentTransactionId: initialCreditSettlement\.paymentTransactionId,/);
    assert.match(handleGenerateSource, /const initialSubmissionContext = await prepareInitialGenerationSubmissionContext\(\{/);
    assert.match(handleGenerateSource, /if \(!initialSubmissionContext\.allowed\) \{/);
    assert.doesNotMatch(handleGenerateSource, /const initialCreditSettlement = await prepareInitialCreditSettlement\(\{/);
    assert.doesNotMatch(appSource, /if \(generationBillingState\.isCreditModel\) \{\s*if \(authLoading\)/);
    assert.doesNotMatch(appSource, /const chargeAttempt = await ensureCreditAttemptCharged\(\{\s*modelId: config\.model,/);
  });

  test('initial generation draft context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );
    const preflightSource = hookSource.slice(
      hookSource.indexOf('const prepareInitialGenerationSubmissionContext = useCallback'),
      hookSource.indexOf('const prepareInitialGeneratingPromptNode = useCallback'),
    );

    assert.match(hookSource, /prepareGenerationDraftContext: \(args: PrepareGenerationDraftContextArgs\) => PrepareGenerationDraftContextResult;/);
    assert.match(hookSource, /const createGenerationPromptNodeId = \(\) => `node_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(16\)\.slice\(2, 8\)\}`;/);
    assert.match(hookSource, /const prepareGenerationDraftContext = useCallback\(\(\{/);
    assert.match(hookSource, /const isFollowUp = !!activeSourceImage;/);
    assert.match(hookSource, /const existingPromptDraftId = String\(draftNodeId \|\| ''\)\.trim\(\);/);
    assert.match(hookSource, /activeCanvasRef\.current\?\.promptNodes\.find\(\(node\) => node\.id === existingPromptDraftId\)/);
    assert.match(hookSource, /const hasReusablePromptDraft = Boolean\(isFollowUp && existingPromptDraft\);/);

    assert.match(preflightSource, /const draftContext = prepareGenerationDraftContext\(\{/);
    assert.match(preflightSource, /promptNodeId: draftContext\.promptNodeId,/);
    assert.match(preflightSource, /isFollowUp: draftContext\.isFollowUp,/);
    assert.match(preflightSource, /hasReusablePromptDraft: draftContext\.hasReusablePromptDraft,/);
    assert.match(handleGenerateSource, /await runInitialGenerationSubmissionTransaction\(\{/);
    assert.match(handleGenerateSource, /initialSubmissionContext,/);
    assert.doesNotMatch(handleGenerateSource, /let promptNodeId = initialSubmissionContext\.promptNodeId;/);
    assert.doesNotMatch(handleGenerateSource, /const isFollowUp = initialSubmissionContext\.isFollowUp;/);
    assert.doesNotMatch(handleGenerateSource, /const hasReusablePromptDraft = initialSubmissionContext\.hasReusablePromptDraft;/);
    assert.doesNotMatch(handleGenerateSource, /const draftContext = prepareGenerationDraftContext\(\{/);
    assert.doesNotMatch(appSource, /const existingPromptDraftId = String\(draftNodeId \|\| ''\)\.trim\(\);/);
    assert.doesNotMatch(appSource, /const existingPromptDraft = existingPromptDraftId/);
    assert.doesNotMatch(appSource, /let promptNodeId = hasReusablePromptDraft/);
  });

  test('initial generation billing attempt context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );
    const preflightSource = hookSource.slice(
      hookSource.indexOf('const prepareInitialGenerationSubmissionContext = useCallback'),
      hookSource.indexOf('const prepareInitialGeneratingPromptNode = useCallback'),
    );

    assert.match(hookSource, /prepareInitialBillingAttemptContext: \(params: PrepareInitialBillingAttemptContextParams\) => PrepareInitialBillingAttemptContextResult;/);
    assert.match(hookSource, /const prepareInitialBillingAttemptContext = useCallback\(\(params: PrepareInitialBillingAttemptContextParams\)/);
    assert.match(hookSource, /const resolvedCreditRoute = params\.generationBillingState\.isCreditModel/);
    assert.match(hookSource, /adminModelService\.getCreditRouteSnapshot\(params\.modelId, params\.imageSize\)/);
    assert.match(hookSource, /const billingAttempt = buildGenerationBillingAttempt\(\{/);
    assert.match(hookSource, /nodeId: params\.promptNodeId,/);
    assert.match(hookSource, /phase: 'initial',/);
    assert.match(hookSource, /useServerSideCreditSettlement: params\.generationBillingState\.useServerSideCreditSettlement,/);

    assert.match(preflightSource, /const billingAttemptContext = prepareInitialBillingAttemptContext\(\{/);
    assert.match(preflightSource, /resolvedCreditRoute: billingAttemptContext\.resolvedCreditRoute,/);
    assert.match(preflightSource, /billingAttempt: billingAttemptContext\.billingAttempt,/);
    assert.match(preflightSource, /useServerSideCreditSettlement: billingAttemptContext\.useServerSideCreditSettlement,/);
    assert.match(hookSource, /resolvedCreditRoute: initialSubmissionContext\.resolvedCreditRoute,/);
    assert.match(hookSource, /billingAttempt: initialSubmissionContext\.billingAttempt,/);
    assert.match(hookSource, /useServerSideCreditSettlement: initialSubmissionContext\.useServerSideCreditSettlement,/);
    assert.doesNotMatch(handleGenerateSource, /const resolvedCreditRoute = initialSubmissionContext\.resolvedCreditRoute;/);
    assert.doesNotMatch(handleGenerateSource, /const billingAttempt = initialSubmissionContext\.billingAttempt;/);
    assert.doesNotMatch(handleGenerateSource, /const useServerSideCreditSettlement = initialSubmissionContext\.useServerSideCreditSettlement;/);
    assert.doesNotMatch(handleGenerateSource, /const billingAttemptContext = prepareInitialBillingAttemptContext\(\{/);
    assert.doesNotMatch(appSource, /const resolvedCreditRoute = generationBillingState\.isCreditModel/);
    assert.doesNotMatch(appSource, /adminModelService\.getCreditRouteSnapshot\(config\.model, config\.imageSize\)/);
    assert.doesNotMatch(appSource, /const billingAttempt = buildGenerationBillingAttempt\(\{/);
  });

  test('initial generation billing state context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );
    const preflightSource = hookSource.slice(
      hookSource.indexOf('const prepareInitialGenerationSubmissionContext = useCallback'),
      hookSource.indexOf('const prepareInitialGeneratingPromptNode = useCallback'),
    );

    assert.match(hookSource, /prepareGenerationBillingStateContext: \(params: PrepareGenerationBillingStateContextParams\) => PrepareGenerationBillingStateContextResult;/);
    assert.match(hookSource, /const prepareGenerationBillingStateContext = useCallback\(\(params: PrepareGenerationBillingStateContextParams\)/);
    assert.match(hookSource, /localStorage\.getItem\('kk_model_customizations'\)/);
    assert.match(hookSource, /params\.hasExplicitModelRoute\(params\.config\.model\)/);
    assert.match(hookSource, /keyManager\.getNextKey\(params\.config\.model, preferredKeyIdForBilling\)/);
    assert.match(hookSource, /resolveGenerationBillingState\(\{/);
    assert.match(hookSource, /console\.log\('\[handleGenerate\] 计费检查'/);

    assert.match(preflightSource, /const billingStateContext = prepareGenerationBillingStateContext\(\{/);
    assert.match(preflightSource, /const selectedKeyForBilling = billingStateContext\.selectedKeyForBilling;/);
    assert.match(preflightSource, /const generationBillingState = billingStateContext\.generationBillingState;/);
    assert.match(hookSource, /selectedKeyForBilling: initialSubmissionContext\.selectedKeyForBilling,/);
    assert.match(hookSource, /generationBillingState: initialSubmissionContext\.generationBillingState,/);
    assert.doesNotMatch(handleGenerateSource, /const selectedKeyForBilling = initialSubmissionContext\.selectedKeyForBilling;/);
    assert.doesNotMatch(handleGenerateSource, /const generationBillingState = initialSubmissionContext\.generationBillingState;/);
    assert.doesNotMatch(handleGenerateSource, /const billingStateContext = prepareGenerationBillingStateContext\(\{/);
    assert.doesNotMatch(appSource, /localStorage\.getItem\('kk_model_customizations'\)/);
    assert.doesNotMatch(appSource, /const selectedKeyForBilling = keyManager\.getNextKey\(config\.model, preferredKeyIdForBilling\);/);
    assert.doesNotMatch(appSource, /const generationBillingState = resolveGenerationBillingState\(\{/);
  });

  test('initial generation submission preflight is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );
    const preflightSource = hookSource.slice(
      hookSource.indexOf('const prepareInitialGenerationSubmissionContext = useCallback'),
      hookSource.indexOf('const prepareInitialGeneratingPromptNode = useCallback'),
    );

    assert.match(hookSource, /export interface PrepareInitialGenerationSubmissionContextParams extends PrepareGenerationDraftContextArgs \{/);
    assert.match(hookSource, /export type PrepareInitialGenerationSubmissionContextResult =/);
    assert.match(hookSource, /prepareInitialGenerationSubmissionContext: \(params: PrepareInitialGenerationSubmissionContextParams\) => Promise<PrepareInitialGenerationSubmissionContextResult>;/);
    assert.match(preflightSource, /const billingStateContext = prepareGenerationBillingStateContext\(\{/);
    assert.match(preflightSource, /const draftContext = prepareGenerationDraftContext\(\{/);
    assert.match(preflightSource, /const billingAttemptContext = prepareInitialBillingAttemptContext\(\{/);
    assert.match(preflightSource, /const initialCreditSettlement = await prepareInitialCreditSettlement\(\{/);
    assert.match(preflightSource, /if \(!initialCreditSettlement\.allowed\) \{/);
    assert.match(preflightSource, /paymentTransactionId: initialCreditSettlement\.paymentTransactionId,/);
    assert.doesNotMatch(preflightSource, /prepareInitialGenerationPromptOptimization|persistInitialGeneratingPromptNode|executeInitialGenerationPromptNode/);

    assert.match(handleGenerateSource, /const initialSubmissionContext = await prepareInitialGenerationSubmissionContext\(\{/);
    assert.match(handleGenerateSource, /if \(!initialSubmissionContext\.allowed\) \{/);
    assert.match(handleGenerateSource, /await runInitialGenerationSubmissionTransaction\(\{/);
    assert.match(handleGenerateSource, /initialSubmissionContext,/);
    assert.doesNotMatch(handleGenerateSource, /let promptNodeId = initialSubmissionContext\.promptNodeId;/);
    assert.doesNotMatch(handleGenerateSource, /const generationBillingState = initialSubmissionContext\.generationBillingState;/);
    assert.doesNotMatch(handleGenerateSource, /const billingStateContext = prepareGenerationBillingStateContext\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const draftContext = prepareGenerationDraftContext\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const billingAttemptContext = prepareInitialBillingAttemptContext\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const initialCreditSettlement = await prepareInitialCreditSettlement\(\{/);
  });

  test('initial generating prompt node assembly is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );

    assert.match(hookSource, /prepareInitialGeneratingPromptNode: \(params: PrepareInitialGeneratingPromptNodeParams\) => PrepareInitialGeneratingPromptNodeResult;/);
    assert.match(hookSource, /const prepareInitialGeneratingPromptNode = useCallback\(\(params: PrepareInitialGeneratingPromptNodeParams\)/);
    assert.match(hookSource, /const generationPreviewState = resolveGenerationPreviewState\(\{/);
    assert.match(hookSource, /const generatingNode = buildGeneratingPromptNode\(\{/);
    assert.match(hookSource, /promptNodeId: params\.promptNodeId,/);
    assert.match(hookSource, /prompt: params\.rawPrompt,/);
    assert.match(hookSource, /paymentTransactionId: params\.paymentTransactionId,/);
    assert.match(hookSource, /billingMode: params\.generationBillingState\.isCreditModel \? 'credits' : 'currency',/);

    assert.match(hookSource, /const initialGeneratingNode = await prepareInitialGeneratingPromptNodeContext\(\{/);
    assert.match(hookSource, /const generatingNode = initialGeneratingNode\.generatingNode;/);
    assert.match(appSource, /const \{[\s\S]*runInitialGenerationSubmissionTransaction,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.match(handleGenerateSource, /await runInitialGenerationSubmissionTransaction\(\{/);
    assert.doesNotMatch(appSource, /const \{[\s\S]*prepareInitialGeneratingPromptNodeContext,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const initialGeneratingNode = await prepareInitialGeneratingPromptNodeContext\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const initialGeneratingNode = prepareInitialGeneratingPromptNode\(\{/);
    assert.doesNotMatch(appSource, /const generationPreviewState = resolveGenerationPreviewState\(\{/);
    assert.doesNotMatch(appSource, /const generatingNode = buildGeneratingPromptNode\(\{/);
  });

  test('initial generating prompt node persistence is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );

    assert.match(hookSource, /persistInitialGeneratingPromptNode: \(params: PersistInitialGeneratingPromptNodeParams\) => Promise<PersistInitialGeneratingPromptNodeResult>;/);
    assert.match(hookSource, /const persistInitialGeneratingPromptNode = useCallback\(async \(params: PersistInitialGeneratingPromptNodeParams\)/);
    assert.match(hookSource, /const persistedGeneratingNode = await persistGeneratingPromptNode\(\{/);
    assert.match(hookSource, /generatingNode: params\.generatingNode,/);
    assert.match(hookSource, /getCanvas: params\.getCanvas,/);
    assert.match(hookSource, /updatePromptNode,/);
    assert.match(hookSource, /addPromptNode: params\.addPromptNode,/);
    assert.match(hookSource, /updateImageNodePosition: params\.updateImageNodePosition,/);
    assert.match(hookSource, /deletePromptNode: params\.deletePromptNode,/);

    assert.match(hookSource, /const persistedGeneration = await persistInitialGeneratingPromptNode\(\{/);
    assert.match(hookSource, /const persistedGeneratingNode = persistedGeneration\.persistedGeneratingNode;/);
    assert.match(hookSource, /await persistAndExecuteInitialGenerationSubmission\(\{/);
    assert.match(handleGenerateSource, /await runInitialGenerationSubmissionTransaction\(\{/);
    assert.doesNotMatch(handleGenerateSource, /persistInitialGeneratingPromptNode\(\{/);
    assert.doesNotMatch(handleGenerateSource, /persistedGeneratingNode/);
    assert.doesNotMatch(handleGenerateSource, /await persistAndExecuteInitialGenerationSubmission\(\{/);
    assert.doesNotMatch(appSource, /const persistedGeneratingNode = await persistGeneratingPromptNode\(\{/);
  });

  test('initial prompt optimization context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );

    assert.match(hookSource, /prepareInitialGenerationPromptOptimization: \(params: PrepareInitialGenerationPromptOptimizationParams\) => Promise<PrepareInitialGenerationPromptOptimizationResult>;/);
    assert.match(hookSource, /const prepareInitialGenerationPromptOptimization = useCallback\(async \(params: PrepareInitialGenerationPromptOptimizationParams\)/);
    assert.match(hookSource, /return optimizeGenerationPrompt\(\{/);
    assert.match(hookSource, /enabled: \(params\.config\.mode === GenerationMode\.IMAGE \|\| params\.config\.mode === GenerationMode\.PPT\)\s*&& params\.config\.enablePromptOptimization/);
    assert.match(hookSource, /referenceImages: params\.finalReferenceImages,/);
    assert.match(hookSource, /supportsThinking: !!getModelCapabilities\(params\.config\.model\)\?\.supportsThinking,/);
    assert.match(hookSource, /notify\.error\('Prompt optimization failed'/);

    assert.match(hookSource, /prepareInitialGeneratingPromptNodeContext\(\{/);
    assert.match(handleGenerateSource, /runInitialGenerationSubmissionTransaction\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const initialPromptOptimization = await prepareInitialGenerationPromptOptimization\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const optimizedPromptEn = initialPromptOptimization\.optimizedPromptEn;/);
    assert.doesNotMatch(appSource, /enabled: \(config\.mode === GenerationMode\.IMAGE \|\| config\.mode === GenerationMode\.PPT\)/);
    assert.doesNotMatch(appSource, /supportsThinking: !!getModelCapabilities\(config\.model\)\?\.supportsThinking,/);
  });

  test('initial prompt optimization and node assembly are composed by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );
    const composedStart = hookSource.indexOf('const prepareInitialGeneratingPromptNodeContext = useCallback');
    const composedEnd = hookSource.indexOf('const persistInitialGeneratingPromptNode = useCallback');
    const composedSource = composedStart === -1 ? '' : hookSource.slice(composedStart, composedEnd);

    assert.match(hookSource, /export interface PrepareInitialGeneratingPromptNodeContextParams extends Omit</);
    assert.match(hookSource, /prepareGenerationReferenceImages: \(referenceImages: ReferenceImage\[\]\) => ReferenceImage\[\];/);
    assert.match(hookSource, /prepareInitialGeneratingPromptNodeContext: \(params: PrepareInitialGeneratingPromptNodeContextParams\) => Promise<PrepareInitialGeneratingPromptNodeContextResult>;/);
    assert.match(hookSource, /const prepareInitialGeneratingPromptNodeContext = useCallback\(async \(params: PrepareInitialGeneratingPromptNodeContextParams\): Promise<PrepareInitialGeneratingPromptNodeContextResult> => \{/);
    assert.match(hookSource, /return \{[\s\S]*prepareInitialGeneratingPromptNodeContext,[\s\S]*\};\s*\}/);

    assert.match(composedSource, /const finalReferenceImages = params\.prepareGenerationReferenceImages\(params\.config\.referenceImages (?:\?\?|\|\|) \[\]\);/);
    assert.match(composedSource, /const initialPromptOptimization = await prepareInitialGenerationPromptOptimization\(\{/);
    assert.match(composedSource, /rawPrompt: params\.rawPrompt,/);
    assert.match(composedSource, /finalReferenceImages,/);
    assert.match(composedSource, /const initialGeneratingNode = prepareInitialGeneratingPromptNode\(\{/);
    assert.match(composedSource, /optimizedPromptEn: initialPromptOptimization\.optimizedPromptEn,/);
    assert.match(composedSource, /optimizedPromptZh: initialPromptOptimization\.optimizedPromptZh,/);
    assert.match(composedSource, /promptOptimizerResult: initialPromptOptimization\.promptOptimizerResult,/);
    assert.match(composedSource, /return initialGeneratingNode;/);
    assert.doesNotMatch(composedSource, /persistInitialGeneratingPromptNode|completeAndExecuteInitialGenerationSubmission|executeGeneration|resolveGenerationPlacement/);

    assert.match(hookSource, /const initialGeneratingNode = await prepareInitialGeneratingPromptNodeContext\(\{/);
    assert.match(appSource, /const \{[\s\S]*runInitialGenerationSubmissionTransaction,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.match(handleGenerateSource, /await runInitialGenerationSubmissionTransaction\(\{/);
    assert.match(handleGenerateSource, /prepareGenerationReferenceImages,/);
    assert.match(handleGenerateSource, /rawPrompt: trimmedPrompt,/);
    assert.doesNotMatch(appSource, /const \{[\s\S]*prepareInitialGeneratingPromptNodeContext,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const initialGeneratingNode = await prepareInitialGeneratingPromptNodeContext\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const finalReferenceImages = prepareGenerationReferenceImages/);
    assert.doesNotMatch(handleGenerateSource, /const initialPromptOptimization = await prepareInitialGenerationPromptOptimization/);
    assert.doesNotMatch(handleGenerateSource, /\boptimizedPromptEn\b|\boptimizedPromptZh\b|\bpromptOptimizerResult\b/);
    assert.doesNotMatch(handleGenerateSource, /prepareInitialGeneratingPromptNode\(\{/);
  });

  test('initial generation persistence and execution handoff is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );
    const persistExecuteSource = hookSource.slice(
      hookSource.indexOf('const persistAndExecuteInitialGenerationSubmission = useCallback'),
      hookSource.indexOf('const runInitialGenerationSubmissionTransaction = useCallback'),
    );

    assert.match(hookSource, /export interface PersistAndExecuteInitialGenerationSubmissionParams[\s\S]*extends PersistInitialGeneratingPromptNodeParams,/);
    assert.match(hookSource, /persistAndExecuteInitialGenerationSubmission: \(params: PersistAndExecuteInitialGenerationSubmissionParams\) => Promise<PersistAndExecuteInitialGenerationSubmissionResult>;/);
    assert.match(hookSource, /const persistAndExecuteInitialGenerationSubmission = useCallback\(async \(\s*params: PersistAndExecuteInitialGenerationSubmissionParams,?\s*\): Promise<PersistAndExecuteInitialGenerationSubmissionResult> => \{/);
    assert.match(hookSource, /return \{[\s\S]*persistAndExecuteInitialGenerationSubmission,[\s\S]*\};\s*\}/);

    assert.match(persistExecuteSource, /const persistedGeneration = await persistInitialGeneratingPromptNode\(\{/);
    assert.match(persistExecuteSource, /generatingNode: params\.generatingNode,/);
    assert.match(persistExecuteSource, /getCanvas: params\.getCanvas,/);
    assert.match(persistExecuteSource, /const persistedGeneratingNode = persistedGeneration\.persistedGeneratingNode;/);
    assert.match(persistExecuteSource, /await completeAndExecuteInitialGenerationSubmission\(\{/);
    assert.match(persistExecuteSource, /persistedGeneratingNode,/);
    assert.match(persistExecuteSource, /requiredCredits: params\.requiredCredits,/);
    assert.match(persistExecuteSource, /useServerSideCreditSettlement: params\.useServerSideCreditSettlement,/);
    assert.match(persistExecuteSource, /return \{ persistedGeneratingNode \};/);
    assert.doesNotMatch(persistExecuteSource, /resolveGenerationPlacement|prepareInitialGeneratingPromptNodeContext|completeRetryGeneratedMediaBatch|handleRetryPptSinglePage|runEcommerce/);

    assert.match(hookSource, /await persistAndExecuteInitialGenerationSubmission\(\{/);
    assert.match(hookSource, /generatingNode,/);
    assert.match(hookSource, /getCanvas: params\.getCanvas,/);
    assert.match(hookSource, /addPromptNode: params\.addPromptNode,/);
    assert.match(hookSource, /updateImageNodePosition: params\.updateImageNodePosition,/);
    assert.match(hookSource, /deletePromptNode: params\.deletePromptNode,/);
    assert.match(hookSource, /const placement = params\.resolveGenerationPlacement\(\{/);
    assert.match(hookSource, /const initialGeneratingNode = await prepareInitialGeneratingPromptNodeContext\(\{/);
    assert.match(appSource, /const \{[\s\S]*runInitialGenerationSubmissionTransaction,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.match(handleGenerateSource, /await runInitialGenerationSubmissionTransaction\(\{/);
    assert.match(handleGenerateSource, /getCanvas: \(\) => activeCanvasRef\.current \|\| undefined,/);
    assert.match(handleGenerateSource, /addPromptNode,/);
    assert.match(handleGenerateSource, /updateImageNodePosition,/);
    assert.match(handleGenerateSource, /deletePromptNode,/);
    assert.doesNotMatch(appSource, /const \{[\s\S]*persistAndExecuteInitialGenerationSubmission,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.doesNotMatch(handleGenerateSource, /await persistAndExecuteInitialGenerationSubmission\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const placement = resolveGenerationPlacement\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const initialGeneratingNode = await prepareInitialGeneratingPromptNodeContext\(\{/);
    assert.doesNotMatch(handleGenerateSource, /persistInitialGeneratingPromptNode\(\{/);
    assert.doesNotMatch(handleGenerateSource, /completeAndExecuteInitialGenerationSubmission\(\{/);
  });

  test('initial generation submission transaction is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );
    const transactionSource = hookSource.slice(
      hookSource.indexOf('const runInitialGenerationSubmissionTransaction = useCallback'),
      hookSource.indexOf('const handleCancelGeneration = useCallback'),
    );

    assert.match(hookSource, /type PreparedInitialGenerationSubmissionContext = Extract<PrepareInitialGenerationSubmissionContextResult, \{ allowed: true \}>;/);
    assert.match(hookSource, /export interface RunInitialGenerationSubmissionTransactionParams/);
    assert.match(hookSource, /initialSubmissionContext: PreparedInitialGenerationSubmissionContext;/);
    assert.match(hookSource, /runInitialGenerationSubmissionTransaction: \(params: RunInitialGenerationSubmissionTransactionParams\) => Promise<void>;/);
    assert.match(hookSource, /const runInitialGenerationSubmissionTransaction = useCallback\(async \(\s*params: RunInitialGenerationSubmissionTransactionParams,?\s*\): Promise<void> => \{/);
    assert.match(hookSource, /return \{[\s\S]*runInitialGenerationSubmissionTransaction,[\s\S]*\};\s*\}/);

    assert.match(transactionSource, /try \{/);
    assert.match(transactionSource, /const placement = params\.resolveGenerationPlacement\(\{/);
    assert.match(transactionSource, /isFollowUp: params\.initialSubmissionContext\.isFollowUp,/);
    assert.match(transactionSource, /hasReusablePromptDraft: params\.initialSubmissionContext\.hasReusablePromptDraft,/);
    assert.match(transactionSource, /const initialGeneratingNode = await prepareInitialGeneratingPromptNodeContext\(\{/);
    assert.match(transactionSource, /promptNodeId: placement\.promptNodeId,/);
    assert.match(transactionSource, /currentPos: placement\.currentPos,/);
    assert.match(transactionSource, /rawPrompt: params\.rawPrompt,/);
    assert.match(transactionSource, /await persistAndExecuteInitialGenerationSubmission\(\{/);
    assert.match(transactionSource, /generatingNode,/);
    assert.match(transactionSource, /requiredCredits: params\.initialSubmissionContext\.requiredCredits,/);
    assert.match(transactionSource, /useServerSideCreditSettlement: params\.initialSubmissionContext\.useServerSideCreditSettlement,/);
    assert.match(transactionSource, /catch \(error\) \{/);
    assert.match(transactionSource, /reportInitialGenerationFailure\(\{ error \}\);/);
    assert.doesNotMatch(transactionSource, /prepareInitialGenerationSubmissionContext\(\{/);

    assert.match(appSource, /const \{[\s\S]*runInitialGenerationSubmissionTransaction,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.match(handleGenerateSource, /const initialSubmissionContext = await prepareInitialGenerationSubmissionContext\(\{/);
    assert.match(handleGenerateSource, /if \(!initialSubmissionContext\.allowed\) \{/);
    assert.match(handleGenerateSource, /await runInitialGenerationSubmissionTransaction\(\{/);
    assert.match(handleGenerateSource, /initialSubmissionContext,/);
    assert.match(handleGenerateSource, /resolveGenerationPlacement,/);
    assert.doesNotMatch(handleGenerateSource, /const placement = resolveGenerationPlacement\(\{/);
    assert.doesNotMatch(handleGenerateSource, /const initialGeneratingNode = await prepareInitialGeneratingPromptNodeContext\(\{/);
    assert.doesNotMatch(handleGenerateSource, /await persistAndExecuteInitialGenerationSubmission\(\{/);
    assert.doesNotMatch(handleGenerateSource, /reportInitialGenerationFailure\(\{ error: e \}\);/);
  });

  test('initial post-persist prompt cleanup is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const handleGenerateSource = appSource.slice(
      appSource.indexOf('const handleGenerate = useCallback'),
      appSource.indexOf('const handleFilesDrop = useCallback'),
    );
    const completionHandoffSource = hookSource.slice(
      hookSource.indexOf('const completeAndExecuteInitialGenerationSubmission = useCallback'),
      hookSource.indexOf('const handleCancelGeneration = useCallback'),
    );

    assert.match(hookSource, /completeInitialGenerationPromptSubmission: \(params: CompleteInitialGenerationPromptSubmissionParams\) => void;/);
    assert.match(hookSource, /const completeInitialGenerationPromptSubmission = useCallback\(\(params: CompleteInitialGenerationPromptSubmissionParams\)/);
    assert.match(hookSource, /params\.setDraftNodeId\(null\);/);
    assert.match(hookSource, /params\.setConfig\(prev => \(\{ \.\.\.prev, prompt: '', referenceImages: \[\] \}\)\);/);
    assert.match(hookSource, /params\.setActiveSourceImage\(null\);/);
    assert.match(hookSource, /completeAndExecuteInitialGenerationSubmission: \(params: CompleteAndExecuteInitialGenerationSubmissionParams\) => Promise<void>;/);
    assert.match(hookSource, /const completeAndExecuteInitialGenerationSubmission = useCallback\(async \(params: CompleteAndExecuteInitialGenerationSubmissionParams\): Promise<void> => \{/);
    assert.match(hookSource, /persistAndExecuteInitialGenerationSubmission: \(params: PersistAndExecuteInitialGenerationSubmissionParams\) => Promise<PersistAndExecuteInitialGenerationSubmissionResult>;/);
    assert.match(hookSource, /return \{[\s\S]*completeAndExecuteInitialGenerationSubmission,[\s\S]*\};\s*\}/);
    assert.match(completionHandoffSource, /completeInitialGenerationPromptSubmission\(\{/);
    assert.match(completionHandoffSource, /await executeInitialGenerationPromptNode\(\{/);

    assert.match(appSource, /const \{[\s\S]*runInitialGenerationSubmissionTransaction,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.match(handleGenerateSource, /runInitialGenerationSubmissionTransaction\(\{/);
    assert.match(hookSource, /completeAndExecuteInitialGenerationSubmission\(\{[\s\S]*persistedGeneratingNode,[\s\S]*\}\);/);
    assert.match(hookSource, /requiredCredits: params\.initialSubmissionContext\.requiredCredits,/);
    assert.match(hookSource, /useServerSideCreditSettlement: params\.initialSubmissionContext\.useServerSideCreditSettlement,/);
    assert.doesNotMatch(appSource, /const \{[\s\S]*persistAndExecuteInitialGenerationSubmission,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.doesNotMatch(handleGenerateSource, /persistAndExecuteInitialGenerationSubmission\(\{/);
    assert.doesNotMatch(handleGenerateSource, /completeInitialGenerationPromptSubmission\(\{/);
    assert.doesNotMatch(handleGenerateSource, /completeAndExecuteInitialGenerationSubmission\(\{/);
    assert.doesNotMatch(handleGenerateSource, /await executeInitialGenerationPromptNode\(\{/);
    assert.doesNotMatch(appSource, /\bcompleteInitialGenerationPromptSubmission\b/);
    assert.doesNotMatch(appSource, /\bexecuteInitialGenerationPromptNode\b/);
    assert.doesNotMatch(
      appSource,
      /setDraftNodeId\(null\); \/\/ Detach status NOW[\s\S]*setConfig\(prev => \(\{ \.\.\.prev, prompt: '', referenceImages: \[\] \}\)\);[\s\S]*setActiveSourceImage\(null\);/,
    );
  });

  test('retry generation failure commit is finalized by complete retry batch runtime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const completeBatchSource = hookSource.slice(
      hookSource.indexOf('const completeRetryGeneratedMediaBatch = useCallback'),
      hookSource.indexOf('const prepareGenerationDraftContext = useCallback'),
    );
    assert.match(hookSource, /commitRetryGenerationFailure: \(params: CommitRetryGenerationFailureParams\) => Promise<void>;/);
    assert.match(hookSource, /const commitRetryGenerationFailure = useCallback\(async \(params: CommitRetryGenerationFailureParams\)/);
    assert.match(hookSource, /const failedBillingState = await resolveFailedCreditAttempt\(params\.executionNode\);/);
    assert.match(hookSource, /await updatePromptNode\(\{/);
    assert.match(hookSource, /\.\.\.params\.executionNode,/);
    assert.match(hookSource, /error: errorMessage,/);
    assert.match(hookSource, /errorDetails: params\.extractErrorDetails\(params\.error, params\.executionNode\.model\),/);
    assert.match(hookSource, /notify\.error\('重试失败', notifyMessage\);/);

    assert.match(hookSource, /extractErrorDetails: CommitRetryGenerationFailureParams\['extractErrorDetails'\];/);
    assert.match(completeBatchSource, /try \{\s*const startedAtMs = Date\.now\(\);/);
    assert.match(completeBatchSource, /const results = await runRetryGeneratedMediaAttempts\(\{/);
    assert.match(completeBatchSource, /await commitRetryGeneratedMediaBatchSuccess\(\{/);
    assert.match(completeBatchSource, /catch \(error: unknown\) \{/);
    assert.match(completeBatchSource, /await commitRetryGenerationFailure\(\{/);
    assert.match(completeBatchSource, /executionNode: params\.executionNode,/);
    assert.match(completeBatchSource, /error,/);
    assert.match(completeBatchSource, /extractErrorDetails: params\.extractErrorDetails,/);

    assert.doesNotMatch(appSource, /const \{[\s\S]*commitRetryGenerationFailure,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.match(retryNodeSource, /extractErrorDetails,/);
    assert.doesNotMatch(retryNodeSource, /await commitRetryGenerationFailure\(\{/);
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

    assert.match(appSource, /await runInitialGenerationSubmissionTransaction\(\{/);
    assert.match(hookSource, /await persistAndExecuteInitialGenerationSubmission\(\{/);
    assert.match(hookSource, /completeAndExecuteInitialGenerationSubmission\(\{[\s\S]*persistedGeneratingNode,[\s\S]*\}\);/);
    assert.match(hookSource, /requiredCredits: params\.initialSubmissionContext\.requiredCredits,/);
    assert.match(hookSource, /useServerSideCreditSettlement: params\.initialSubmissionContext\.useServerSideCreditSettlement,/);
    assert.match(appSource, /executeGeneration,/);
    assert.doesNotMatch(appSource, /await persistAndExecuteInitialGenerationSubmission\(\{/);
    assert.doesNotMatch(appSource, /await completeAndExecuteInitialGenerationSubmission\(\{/);
    assert.doesNotMatch(appSource, /await executeInitialGenerationPromptNode\(\{/);
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

    assert.match(hookSource, /reportInitialGenerationFailure\(\{ error \}\);/);
    assert.match(handleGenerateSource, /runInitialGenerationSubmissionTransaction\(\{/);
    assert.doesNotMatch(handleGenerateSource, /reportInitialGenerationFailure\(\{ error: e \}\);/);
    assert.doesNotMatch(handleGenerateSource, /console\.error\('\[handleGenerate\] failed:', e\);/);
    assert.doesNotMatch(handleGenerateSource, /notify\.error\('发送失败', e\?\.message \|\| '请重试'\);/);
  });

  test('retry generation timeout guard is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const attemptRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaAttemptRequest = useCallback'),
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
    );

    assert.match(hookSource, /createRetryGenerationTimeoutGuard: \(params: CreateRetryGenerationTimeoutGuardParams\) => CreateRetryGenerationTimeoutGuardResult;/);
    assert.match(hookSource, /const createRetryGenerationTimeoutGuard = useCallback\(\(params: CreateRetryGenerationTimeoutGuardParams\)/);
    assert.match(hookSource, /const timer = setTimeout\(\(\) => \{/);
    assert.match(hookSource, /cancelGenerationRequest\(params\.requestId\);/);
    assert.match(hookSource, /void updatePromptNode\(\{/);
    assert.match(hookSource, /responseBody: `Retry request exceeded \$\{params\.timeoutMs\}ms timeout`,/);
    assert.match(hookSource, /markFinished: \(\) => \{/);
    assert.match(hookSource, /clear: \(\) => clearTimeout\(timer\),/);

    assert.match(attemptRequestSource, /const \{ requestId, timeoutGuard \} = prepareRetryGeneratedMediaAttemptContext\(\{/);
    assert.match(attemptRequestSource, /timeoutMs: params\.timeoutMs,/);
    assert.match(retryNodeSource, /timeoutMs: GENERATE_TIMEOUT_MS,/);
    assert.doesNotMatch(retryNodeSource, /prepareRetryGeneratedMediaAttemptContext/);
    assert.doesNotMatch(retryNodeSource, /const timeoutGuard = createRetryGenerationTimeoutGuard\(\{/);
    assert.doesNotMatch(retryNodeSource, /const timer = setTimeout\(\(\) => \{/);
    assert.doesNotMatch(retryNodeSource, /cancelGeneration\(requestId\);/);
    assert.doesNotMatch(retryNodeSource, /Retry request exceeded 600000ms timeout/);
  });

  test('retry generated media attempt guard finalization is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const guardRunnerSource = hookSource.slice(
      hookSource.indexOf('const runRetryGeneratedMediaAttemptWithGuard = useCallback'),
      hookSource.indexOf('const commitRetryGenerationStart = useCallback'),
    );
    const attemptRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaAttemptRequest = useCallback'),
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
    );

    assert.match(hookSource, /finalizeRetryGeneratedMediaAttemptGuard: \(params: FinalizeRetryGeneratedMediaAttemptGuardParams\) => void;/);
    assert.match(hookSource, /runRetryGeneratedMediaAttemptWithGuard: <T>\(params: RunRetryGeneratedMediaAttemptWithGuardParams<T>\) => Promise<T>;/);
    assert.match(hookSource, /const finalizeRetryGeneratedMediaAttemptGuard = useCallback\(\(params: FinalizeRetryGeneratedMediaAttemptGuardParams\): void => \{/);
    assert.match(hookSource, /params\.timeoutGuard\.markFinished\(\);/);
    assert.match(hookSource, /params\.timeoutGuard\.clear\(\);/);
    assert.match(hookSource, /const runRetryGeneratedMediaAttemptWithGuard = useCallback\(async <T,>\(params: RunRetryGeneratedMediaAttemptWithGuardParams<T>\): Promise<T> => \{/);
    assert.match(hookSource, /const result = await params\.run\(\);/);
    assert.match(hookSource, /finalizeRetryGeneratedMediaAttemptGuard\(\{ timeoutGuard: params\.timeoutGuard \}\);/);
    assert.match(hookSource, /finalizeRetryGeneratedMediaAttemptGuard,/);
    assert.match(hookSource, /runRetryGeneratedMediaAttemptWithGuard,/);
    assert.match(guardRunnerSource, /const result = await params\.run\(\);[\s\S]*finalizeRetryGeneratedMediaAttemptGuard\(\{ timeoutGuard: params\.timeoutGuard \}\);[\s\S]*return result;/);
    assert.match(guardRunnerSource, /catch \(e\) \{[\s\S]*finalizeRetryGeneratedMediaAttemptGuard\(\{ timeoutGuard: params\.timeoutGuard \}\);[\s\S]*throw e;/);

    assert.match(attemptRequestSource, /return runRetryGeneratedMediaAttemptWithGuard\(\{[\s\S]*timeoutGuard,[\s\S]*run: async \(\) => \{/);
    assert.match(attemptRequestSource, /const requestResult = await executeRetryGeneratedMediaRequest\(\{/);
    assert.match(attemptRequestSource, /return requestResult;/);
    assert.doesNotMatch(attemptRequestSource, /prepareRetryGeneratedMediaPersistence|resolveRetryGeneratedMediaDimensions|assembleRetryGeneratedMediaAttemptResult/);
    assert.doesNotMatch(retryNodeSource, /runRetryGeneratedMediaAttemptWithGuard/);
    assert.doesNotMatch(retryNodeSource, /finalizeRetryGeneratedMediaAttemptGuard\(\{ timeoutGuard \}\);/);
    assert.doesNotMatch(retryNodeSource, /catch \(e: any\)/);
    assert.doesNotMatch(retryNodeSource, /timeoutGuard\.markFinished\(\);/);
    assert.doesNotMatch(retryNodeSource, /timeoutGuard\.clear\(\);/);
  });

  test('retry generated media attempt context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const attemptRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaAttemptRequest = useCallback'),
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
    );

    assert.match(hookSource, /prepareRetryGeneratedMediaAttemptContext: \(params: PrepareRetryGeneratedMediaAttemptContextParams\) => PrepareRetryGeneratedMediaAttemptContextResult;/);
    assert.match(hookSource, /const prepareRetryGeneratedMediaAttemptContext = useCallback\(\(params: PrepareRetryGeneratedMediaAttemptContextParams\): PrepareRetryGeneratedMediaAttemptContextResult => \{/);
    assert.match(hookSource, /const requestId = buildGenerationAttemptRequestId\(/);
    assert.match(hookSource, /params\.executionNode\.billingAttemptId \|\| params\.currentNodeId,/);
    assert.match(hookSource, /timeoutGuard: createRetryGenerationTimeoutGuard\(\{/);

    assert.match(attemptRequestSource, /const \{ requestId, timeoutGuard \} = prepareRetryGeneratedMediaAttemptContext\(\{/);
    assert.match(attemptRequestSource, /timeoutMs: params\.timeoutMs,/);
    assert.match(retryNodeSource, /timeoutMs: GENERATE_TIMEOUT_MS,/);
    assert.doesNotMatch(retryNodeSource, /prepareRetryGeneratedMediaAttemptContext/);
    assert.doesNotMatch(retryNodeSource, /const requestId = buildGenerationAttemptRequestId\(/);
    assert.doesNotMatch(retryNodeSource, /const timeoutGuard = createRetryGenerationTimeoutGuard\(\{/);
  });

  test('retry generation start commit is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const completeBatchSource = hookSource.slice(
      hookSource.indexOf('const completeRetryGeneratedMediaBatch = useCallback'),
      hookSource.indexOf('const prepareGenerationDraftContext = useCallback'),
    );

    assert.doesNotMatch(hookSource, /commitRetryGenerationStart: \(params: CommitRetryGenerationStartParams\) => void;/);
    assert.match(hookSource, /const commitRetryGenerationStart = useCallback\(\(params: CommitRetryGenerationStartParams\)/);
    assert.match(hookSource, /updatePromptNode\(\{/);
    assert.match(hookSource, /\.\.\.params\.executionNode,/);
    assert.match(hookSource, /modelLabel: params\.resolveModelDisplayName\(params\.executionNode\.model, params\.executionNode\.modelLabel \|\| params\.executionNode\.model\),/);
    assert.match(hookSource, /isGenerating: true,/);
    assert.match(hookSource, /timestamp: Date\.now\(\)/);
    assert.match(hookSource, /applyOptimisticServerCreditDebit\(\s*params\.retryBillingState\.requiredCredits,\s*params\.retryBillingState\.useServerSideCreditSettlement,\s*\);/);
    assert.match(hookSource, /retryBillingState: CommitRetryGenerationStartParams\['retryBillingState'\];/);
    assert.match(completeBatchSource, /commitRetryGenerationStart\(\{[\s\S]*executionNode: params\.executionNode,[\s\S]*retryBillingState: params\.retryBillingState,[\s\S]*resolveModelDisplayName: params\.resolveModelDisplayName,[\s\S]*\}\);\s*try \{/);

    assert.doesNotMatch(appSource, /const \{[\s\S]*commitRetryGenerationStart,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.doesNotMatch(retryNodeSource, /commitRetryGenerationStart\(\{/);
    assert.match(retryNodeSource, /retryBillingState,/);
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
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const pptSingleRetrySource = hookSource.slice(
      hookSource.indexOf('const handleRetryPptSinglePage = useCallback'),
      hookSource.indexOf('const handleCancelGeneration = useCallback'),
    );
    const retryRecoverySource = hookSource.slice(
      hookSource.indexOf('const recoverRetryGenerationBridge = useCallback'),
      hookSource.indexOf('const prepareRetryGenerationRequestContext = useCallback'),
    );
    const retryPreparationSource = hookSource.slice(
      hookSource.indexOf('const prepareRetryGeneratedMediaExecutionContext = useCallback'),
      hookSource.indexOf('const reportRetryGenerationSuccess = useCallback'),
    );

    assert.match(hookSource, /reportRetryRecoveryResult: \(params: ReportRetryRecoveryResultParams\) => void;/);
    assert.match(hookSource, /const reportRetryRecoveryResult = useCallback\(\(params: ReportRetryRecoveryResultParams\)/);
    assert.match(hookSource, /if \(params\.recoveredCount <= 0 && params\.pendingCount <= 0\) \{/);
    assert.match(hookSource, /const message = params\.pendingCount > 0/);
    assert.match(hookSource, /notify\.info\('恢复历史结果', message\);/);
    assert.match(hookSource, /recoverRetryGenerationBridge: \(params: RecoverRetryGenerationBridgeParams\) => Promise<RecoverRetryGenerationBridgeResult>;/);
    assert.match(hookSource, /const recoverRetryGenerationBridge = useCallback\(async \(params: RecoverRetryGenerationBridgeParams\): Promise<RecoverRetryGenerationBridgeResult> => \{/);
    assert.match(retryRecoverySource, /const recovered = await params\.recoverFailedSyncBridgeGeneration\(params\.executionNode\);/);
    assert.match(retryRecoverySource, /const shouldShortCircuit = recovered\.recoveredCount > 0 \|\| recovered\.pendingCount > 0;/);
    assert.match(retryRecoverySource, /if \(shouldShortCircuit\) \{/);
    assert.match(retryRecoverySource, /reportRetryRecoveryResult\(\{ recoveredCount: recovered\.recoveredCount, pendingCount: recovered\.pendingCount \}\);/);

    assert.match(retryPreparationSource, /const retryRecovery = await recoverRetryGenerationBridge\(\{/);
    assert.match(retryPreparationSource, /executionNode: retryExecutionNode,/);
    assert.match(retryPreparationSource, /recoverFailedSyncBridgeGeneration: params\.recoverFailedSyncBridgeGeneration,/);
    assert.match(retryPreparationSource, /if \(retryRecovery\.shouldShortCircuit\) \{/);
    assert.match(retryNodeSource, /recoverFailedSyncBridgeGeneration,/);
    assert.doesNotMatch(retryNodeSource, /const retryRecovery = await recoverRetryGenerationBridge\(\{/);
    assert.doesNotMatch(retryNodeSource, /if \(retryRecovery\.shouldShortCircuit\) \{/);
    assert.doesNotMatch(retryNodeSource, /const recovered = await recoverFailedSyncBridgeGeneration\(executionNode\);/);
    assert.doesNotMatch(retryNodeSource, /reportRetryRecoveryResult\(\{/);
    assert.doesNotMatch(retryNodeSource, /notify\.info\('恢复历史结果', message\);/);
    assert.doesNotMatch(retryNodeSource, /已重新接管 \$\{recovered\.pendingCount\}/);
    assert.match(hookSource, /handleRetryPptSinglePage: \(node: PromptNode, pageIndex: number\) => Promise<void>;/);
    assert.match(hookSource, /const handleRetryPptSinglePage = useCallback\(async \(node: PromptNode, pageIndex: number\) => \{/);
    assert.match(appSource, /const \{[\s\S]*handleRetryPptSinglePage,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.doesNotMatch(appSource, /const handleRetryPptSinglePage = useCallback\(async \(node: PromptNode, pageIndex: number\) => \{/);
    assert.match(pptSingleRetrySource, /buildRetryExecutionNode\(\{/);
    assert.match(pptSingleRetrySource, /prepareRetriedExecutionNode\(\{/);
    assert.doesNotMatch(pptSingleRetrySource, /prepareRetryGeneratedMediaExecutionContext\(\{/);
  });

  test('retry generation request context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const retryPreparationSource = hookSource.slice(
      hookSource.indexOf('const prepareRetryGeneratedMediaExecutionContext = useCallback'),
      hookSource.indexOf('const reportRetryGenerationSuccess = useCallback'),
    );

    assert.match(hookSource, /prepareRetryGenerationRequestContext: \(params: PrepareRetryGenerationRequestContextParams\) => PrepareRetryGenerationRequestContextResult;/);
    assert.match(hookSource, /const prepareRetryGenerationRequestContext = useCallback\(\(params: PrepareRetryGenerationRequestContextParams\)/);
    assert.match(hookSource, /const currentNodeId = params\.node\.id;/);
    assert.match(hookSource, /const requestedCount = params\.node\.parallelCount \|\| params\.defaultParallelCount \|\| 1;/);
    assert.match(hookSource, /const count = params\.node\.mode === GenerationMode\.PPT \? Math\.min\(20, Math\.max\(1, requestedCount\)\) : requestedCount;/);

    assert.match(retryPreparationSource, /const \{ currentNodeId, requestedCount, count \} = prepareRetryGenerationRequestContext\(\{/);
    assert.match(retryPreparationSource, /defaultParallelCount: params\.defaultParallelCount,/);
    assert.match(retryNodeSource, /prepareRetryGeneratedMediaExecutionContext\(\{[\s\S]*defaultParallelCount: config\.parallelCount,[\s\S]*\}\);/);
    assert.doesNotMatch(retryNodeSource, /const \{ currentNodeId, count \} = prepareRetryGenerationRequestContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /const currentNodeId = node\.id;/);
    assert.doesNotMatch(retryNodeSource, /const requestedCount = node\.parallelCount \|\| config\.parallelCount \|\| 1;/);
    assert.doesNotMatch(retryNodeSource, /const count = node\.mode === GenerationMode\.PPT \? Math\.min\(20, Math\.max\(1, requestedCount\)\) : requestedCount;/);
  });

  test('retry generated media execution preparation is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const retryPreparationSource = hookSource.slice(
      hookSource.indexOf('const prepareRetryGeneratedMediaExecutionContext = useCallback'),
      hookSource.indexOf('const reportRetryGenerationSuccess = useCallback'),
    );

    assert.match(hookSource, /export interface PrepareRetryGeneratedMediaExecutionContextParams \{/);
    assert.match(hookSource, /export type PrepareRetryGeneratedMediaExecutionContextResult =/);
    assert.match(hookSource, /prepareRetryGeneratedMediaExecutionContext: \(params: PrepareRetryGeneratedMediaExecutionContextParams\) => Promise<PrepareRetryGeneratedMediaExecutionContextResult>;/);
    assert.match(retryPreparationSource, /const preparedRetry = await prepareRetriedExecutionNode\(\{/);
    assert.match(retryPreparationSource, /phase: 'retry',/);
    assert.match(retryPreparationSource, /ensureCreditAttemptCharged,/);
    assert.match(retryPreparationSource, /const retryExecutionNode = buildRetryExecutionNode\(\{/);
    assert.match(retryPreparationSource, /node: params\.node,/);
    assert.match(retryPreparationSource, /resolveNodeRouteState: params\.resolveNodeRouteState,/);
    assert.match(retryPreparationSource, /const retryRecovery = await recoverRetryGenerationBridge\(\{/);
    assert.match(retryPreparationSource, /return \{\s*prepared: false as const,\s*\};/);
    assert.match(retryPreparationSource, /return \{[\s\S]*prepared: true as const,[\s\S]*executionNode: preparedRetry\.executionNode,[\s\S]*retryBillingState: preparedRetry\.billingState,[\s\S]*\};/);

    assert.match(retryNodeSource, /const retryExecutionContext = await prepareRetryGeneratedMediaExecutionContext\(\{/);
    assert.match(retryNodeSource, /resolveNodeRouteState,/);
    assert.match(retryNodeSource, /recoverFailedSyncBridgeGeneration,/);
    assert.match(retryNodeSource, /if \(!retryExecutionContext\.prepared\) \{/);
    assert.match(retryNodeSource, /const \{ currentNodeId, count, retryBillingState \} = retryExecutionContext;/);
    assert.match(retryNodeSource, /executionNode = retryExecutionContext\.executionNode;/);
    assert.doesNotMatch(retryNodeSource, /buildRetryExecutionNode\(\{/);
    assert.doesNotMatch(retryNodeSource, /recoverRetryGenerationBridge\(\{/);
    assert.doesNotMatch(retryNodeSource, /prepareRetriedExecutionNode\(\{/);
    assert.doesNotMatch(retryNodeSource, /const \{ billingAttempt: retryBillingAttempt, billingState: retryBillingState \} = preparedRetry;/);
  });

  test('retry generation success side effects are owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );

    assert.match(hookSource, /reportRetryGenerationSuccess: \(params: ReportRetryGenerationSuccessParams\) => void;/);
    assert.match(hookSource, /const reportRetryGenerationSuccess = useCallback\(\(params: ReportRetryGenerationSuccessParams\)/);
    assert.match(hookSource, /const effectiveSize = params\.alignedImageNodes\[0\]\?\.imageSize \|\| params\.executionNode\.imageSize;/);
    assert.match(hookSource, /import\('\.\.\/services\/billing\/costService'\)\.then\(\(\{ recordCost \}\) => \{/);
    assert.match(hookSource, /recordCost\(/);
    assert.match(hookSource, /notify\.success\('生成完成', '重新生成成功'\);/);

    assert.match(retryNodeSource, /completeRetryGeneratedMediaBatch\(\{[\s\S]*executionNode,[\s\S]*\}\);/);
    assert.doesNotMatch(retryNodeSource, /const effectiveSize = alignedImageNodes\[0\]\?\.imageSize \|\| executionNode\.imageSize;/);
    assert.doesNotMatch(retryNodeSource, /import\('\.\/services\/billing\/costService'\)/);
    assert.doesNotMatch(retryNodeSource, /notify\.success\('生成完成', '重新生成成功'\);/);
  });

  test('retry generated media success commit is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const commitSuccessSource = hookSource.slice(
      hookSource.indexOf('const commitRetryGeneratedMediaSuccess = useCallback'),
      hookSource.indexOf('const prepareRetryGenerationTaskPromptContext = useCallback'),
    );

    assert.match(hookSource, /commitRetryGeneratedMediaSuccess: \(params: CommitRetryGeneratedMediaSuccessParams\) => Promise<void>;/);
    assert.match(hookSource, /const commitRetryGeneratedMediaSuccess = useCallback\(async \(params: CommitRetryGeneratedMediaSuccessParams\): Promise<void> => \{/);
    assert.match(hookSource, /await params\.addImageNodes\(params\.alignedImageNodes, \{/);
    assert.match(hookSource, /\[params\.parentNodeId\]: params\.retryCompletedPromptPatch,/);
    assert.match(hookSource, /reportRetryGenerationSuccess\(\{/);
    assert.match(commitSuccessSource, /await params\.addImageNodes\([\s\S]*reportRetryGenerationSuccess\(\{/);

    assert.match(retryNodeSource, /await completeRetryGeneratedMediaBatch\(\{/);
    assert.match(retryNodeSource, /parentNodeId: node\.id,/);
    assert.doesNotMatch(retryNodeSource, /await commitRetryGeneratedMediaSuccess\(\{/);
    assert.doesNotMatch(retryNodeSource, /retryCompletedPromptPatch,/);
    assert.doesNotMatch(retryNodeSource, /addImageNodes\(alignedImageNodes, \{/);
    assert.doesNotMatch(retryNodeSource, /reportRetryGenerationSuccess\(\{/);
  });

  test('retry generation task prompt context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const attemptRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaAttemptRequest = useCallback'),
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
    );

    assert.match(hookSource, /prepareRetryGenerationTaskPromptContext: \(params: PrepareRetryGenerationTaskPromptContextParams\) => PrepareRetryGenerationTaskPromptContextResult;/);
    assert.match(hookSource, /const prepareRetryGenerationTaskPromptContext = useCallback\(\(params: PrepareRetryGenerationTaskPromptContextParams\)/);
    assert.match(hookSource, /const currentMode = params\.executionNode\.mode \|\| GenerationMode\.IMAGE;/);
    assert.match(hookSource, /const slideLines = \(params\.executionNode\.pptSlides \|\| \[\]\)[\s\S]*?\.map/);
    assert.match(hookSource, /params\.executionNode\.pptStyleLocked !== false/);
    assert.match(hookSource, /PPT 第 \$\{params\.index \+ 1\}\/\$\{params\.count\} 页/);

    assert.match(attemptRequestSource, /const \{ currentMode, taskPrompt \} = prepareRetryGenerationTaskPromptContext\(\{/);
    assert.match(attemptRequestSource, /sourcePrompt: params\.sourcePrompt,/);
    assert.match(retryNodeSource, /sourcePrompt: node\.prompt,/);
    assert.doesNotMatch(retryNodeSource, /prepareRetryGenerationTaskPromptContext/);
    assert.doesNotMatch(retryNodeSource, /const currentMode: GenerationMode = executionNode\.mode \|\| GenerationMode\.IMAGE;/);
    assert.doesNotMatch(retryNodeSource, /const taskPrompt = currentMode === GenerationMode\.PPT/);
    assert.doesNotMatch(retryNodeSource, /const styleDirective = executionNode\.pptStyleLocked !== false/);
  });

  test('retry video generation request options are owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const executeRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaRequest = useCallback'),
      hookSource.indexOf('const applyRetryGeneratedMediaAuthoritativeBalance = useCallback'),
    );
    assert.match(hookSource, /prepareRetryVideoGenerationRequest: \(params: PrepareRetryVideoGenerationRequestParams\) => PrepareRetryVideoGenerationRequestResult;/);
    assert.match(hookSource, /const prepareRetryVideoGenerationRequest = useCallback\(\(params: PrepareRetryVideoGenerationRequestParams\)/);
    assert.match(hookSource, /if \(params\.executionNode\.videoResolution\) return params\.executionNode\.videoResolution;/);
    assert.match(hookSource, /const size = params\.executionNode\.imageSize\?\.toLowerCase\(\) \|\| '';/);
    assert.match(hookSource, /const videoAspect = params\.executionNode\.aspectRatio === '9:16' \? '9:16' : '16:9';/);
    assert.match(hookSource, /providerConfig: \{[\s\S]*google: \{[\s\S]*imageConfig: \{ imageSize: videoResolution \}[\s\S]*\}[\s\S]*\}/);

    assert.match(executeRequestSource, /const videoRequest = prepareRetryVideoGenerationRequest\(\{ executionNode: params\.executionNode, taskPrompt: params\.taskPrompt \}\);/);
    assert.match(executeRequestSource, /const videoResult = await params\.generateVideo\(videoRequest\);/);
    assert.doesNotMatch(retryNodeSource, /const videoRequest = prepareRetryVideoGenerationRequest/);
    assert.doesNotMatch(retryNodeSource, /const videoResult = await llmService\.generateVideo/);
    assert.doesNotMatch(retryNodeSource, /const videoResolution = \(\(\) => \{/);
    assert.doesNotMatch(retryNodeSource, /const videoAspect = executionNode\.aspectRatio === '9:16' \? '9:16' : '16:9';/);
    assert.doesNotMatch(retryNodeSource, /providerConfig: \{[\s\S]*google: \{[\s\S]*imageConfig: \{ imageSize: videoResolution \}/);
  });

  test('retry video generation result normalization is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const executeRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaRequest = useCallback'),
      hookSource.indexOf('const applyRetryGeneratedMediaAuthoritativeBalance = useCallback'),
    );
    const assembleAttemptResultSource = hookSource.slice(
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );
    assert.match(hookSource, /buildRetryVideoGenerationResultContext: \(params: BuildRetryVideoGenerationResultContextParams\) => BuildRetryVideoGenerationResultContextResult;/);
    assert.match(hookSource, /const buildRetryVideoGenerationResultContext = useCallback\(\(\s*params: BuildRetryVideoGenerationResultContextParams,\s*\): BuildRetryVideoGenerationResultContextResult => \{/);
    assert.match(hookSource, /const usage = params\.videoResult\.usage as/);
    assert.match(hookSource, /b64: params\.videoResult\.url,/);
    assert.match(hookSource, /keySlotId: params\.videoResult\.keySlotId \|\| params\.executionNode\.keySlotId,/);
    assert.match(hookSource, /costSource: cost !== undefined \? 'explicit' : 'none',/);

    assert.match(executeRequestSource, /generatedMediaContext = buildRetryVideoGenerationResultContext\(\{/);
    assert.match(executeRequestSource, /videoResult,/);
    assert.match(assembleAttemptResultSource, /const \{ apiDurationMs, b64 \} = params\.generatedMediaContext;/);
    assert.doesNotMatch(retryNodeSource, /const \{ apiDurationMs, b64 \} = generatedMediaContext;/);
    assert.doesNotMatch(retryNodeSource, /buildRetryVideoGenerationResultContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /actualKeySlotId = videoResult\.keySlotId \|\| actualKeySlotId;/);
    assert.doesNotMatch(retryNodeSource, /actualProvider = videoResult\.provider \|\| actualProvider;/);
    assert.doesNotMatch(retryNodeSource, /\(videoResult as any\)\.usage\?\.cost/);
  });

  test('retry image generation request options are owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const executeRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaRequest = useCallback'),
      hookSource.indexOf('const applyRetryGeneratedMediaAuthoritativeBalance = useCallback'),
    );

    assert.match(hookSource, /prepareRetryImageGenerationRequest: \(params: PrepareRetryImageGenerationRequestParams\) => PrepareRetryImageGenerationRequestResult;/);
    assert.match(hookSource, /const prepareRetryImageGenerationRequest = useCallback\(\(params: PrepareRetryImageGenerationRequestParams\)/);
    assert.match(hookSource, /grounding: !!params\.executionNode\.enableGrounding \|\| !!params\.executionNode\.enableImageSearch,/);
    assert.match(hookSource, /preferredKeyId: params\.executionNode\.keySlotId,/);
    assert.match(hookSource, /enableWebSearch: !!params\.executionNode\.enableGrounding,/);
    assert.match(hookSource, /thinkingMode: params\.executionNode\.thinkingMode \|\| 'minimal'/);

    assert.match(executeRequestSource, /const imageRequest = prepareRetryImageGenerationRequest\(\{ executionNode: params\.executionNode, requestId: params\.requestId, taskPrompt: params\.taskPrompt \}\);/);
    assert.match(executeRequestSource, /const result = await params\.generateImage\([\s\S]*\.\.\.imageRequest\.args,[\s\S]*imageRequest\.grounding,[\s\S]*imageRequest\.options,[\s\S]*\);/);
    assert.doesNotMatch(retryNodeSource, /const imageRequest = prepareRetryImageGenerationRequest/);
    assert.doesNotMatch(retryNodeSource, /const result = await generateImage\([\s\S]*\.\.\.imageRequest\.args/);
    assert.doesNotMatch(retryNodeSource, /!!executionNode\.enableGrounding \|\| !!executionNode\.enableImageSearch/);
    assert.doesNotMatch(retryNodeSource, /preferredKeyId: executionNode\.keySlotId/);
    assert.doesNotMatch(retryNodeSource, /thinkingMode: executionNode\.thinkingMode \|\| 'minimal'/);
  });

  test('retry image generation result normalization is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const executeRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaRequest = useCallback'),
      hookSource.indexOf('const applyRetryGeneratedMediaAuthoritativeBalance = useCallback'),
    );
    const assembleAttemptResultSource = hookSource.slice(
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );
    const attemptRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaAttemptRequest = useCallback'),
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
    );

    assert.match(hookSource, /buildRetryImageGenerationResultContext: \(params: BuildRetryImageGenerationResultContextParams\) => BuildRetryImageGenerationResultContextResult;/);
    assert.match(hookSource, /const buildRetryImageGenerationResultContext = useCallback\(\(\s*params: BuildRetryImageGenerationResultContextParams,\s*\): BuildRetryImageGenerationResultContextResult => \{/);
    assert.match(hookSource, /b64: params\.result\.url,/);
    assert.match(hookSource, /apiDurationMs: params\.result\.apiDurationMs,/);
    assert.match(hookSource, /const model = params\.result\.effectiveModel \|\| params\.executionNode\.model;/);
    assert.match(hookSource, /model,/);
    assert.match(hookSource, /modelLabel: params\.resolveModelDisplayName\(/);
    assert.match(hookSource, /balanceAfter: params\.result\.balanceAfter,/);

    assert.match(executeRequestSource, /generatedMediaContext = buildRetryImageGenerationResultContext\(\{/);
    assert.match(executeRequestSource, /resolveModelDisplayName: params\.resolveModelDisplayName,/);
    assert.match(assembleAttemptResultSource, /const \{ apiDurationMs, b64 \} = params\.generatedMediaContext;/);
    assert.match(attemptRequestSource, /applyRetryGeneratedMediaAuthoritativeBalance\(\{/);
    assert.doesNotMatch(retryNodeSource, /applyRetryGeneratedMediaAuthoritativeBalance\(\{/);
    assert.doesNotMatch(retryNodeSource, /const \{ apiDurationMs, b64 \} = generatedMediaContext;/);
    assert.doesNotMatch(retryNodeSource, /buildRetryImageGenerationResultContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /actualProvider = result\.provider \|\| actualProvider;/);
    assert.doesNotMatch(retryNodeSource, /actualModel = result\.effectiveModel \|\| actualModel;/);
    assert.doesNotMatch(retryNodeSource, /actualCost = typeof result\.cost === 'number'/);
  });

  test('retry generated media request execution is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const executeRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaRequest = useCallback'),
      hookSource.indexOf('const applyRetryGeneratedMediaAuthoritativeBalance = useCallback'),
    );
    const attemptRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaAttemptRequest = useCallback'),
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
    );
    const pptSingleRetrySource = hookSource.slice(
      hookSource.indexOf('const handleRetryPptSinglePage = useCallback'),
      hookSource.indexOf('const handleCancelGeneration = useCallback'),
    );

    assert.match(hookSource, /export interface ExecuteRetryGeneratedMediaRequestParams \{/);
    assert.match(hookSource, /export interface ExecuteRetryGeneratedMediaRequestResult \{/);
    assert.match(hookSource, /generateImage: RetryGeneratedMediaGenerateImage;/);
    assert.match(hookSource, /generateVideo: RetryGeneratedMediaGenerateVideo;/);
    assert.match(hookSource, /executeRetryGeneratedMediaRequest: \(params: ExecuteRetryGeneratedMediaRequestParams\) => Promise<ExecuteRetryGeneratedMediaRequestResult>;/);
    assert.match(executeRequestSource, /if \(params\.currentMode === GenerationMode\.VIDEO\) \{/);
    assert.match(executeRequestSource, /const videoRequest = prepareRetryVideoGenerationRequest\(\{ executionNode: params\.executionNode, taskPrompt: params\.taskPrompt \}\);/);
    assert.match(executeRequestSource, /const videoResult = await params\.generateVideo\(videoRequest\);/);
    assert.match(executeRequestSource, /generatedMediaContext = buildRetryVideoGenerationResultContext\(\{/);
    assert.match(executeRequestSource, /const imageRequest = prepareRetryImageGenerationRequest\(\{ executionNode: params\.executionNode, requestId: params\.requestId, taskPrompt: params\.taskPrompt \}\);/);
    assert.match(executeRequestSource, /const result = await params\.generateImage\([\s\S]*\.\.\.imageRequest\.args,[\s\S]*imageRequest\.grounding,[\s\S]*imageRequest\.options,[\s\S]*\);/);
    assert.match(executeRequestSource, /generatedMediaContext = buildRetryImageGenerationResultContext\(\{/);
    assert.match(executeRequestSource, /return \{\s*currentMode: params\.currentMode,\s*taskPrompt: params\.taskPrompt,\s*generatedMediaContext,\s*\};/);
    assert.doesNotMatch(executeRequestSource, /prepareRetryGenerationTaskPromptContext|applyRetryGeneratedMediaAuthoritativeBalance|prepareRetryGeneratedMediaPersistence|scheduleRetryGeneratedMediaCloudSync|resolveRetryGeneratedMediaDimensions|buildRetryGeneratedMediaResultFromContext|prepareRetryGeneratedMediaSuccessCommitContext|commitRetryGeneratedMediaSuccess|addImageNodes/);

    assert.match(attemptRequestSource, /const \{ currentMode, taskPrompt \} = prepareRetryGenerationTaskPromptContext\(\{/);
    assert.match(attemptRequestSource, /const requestResult = await executeRetryGeneratedMediaRequest\(\{/);
    assert.match(retryNodeSource, /completeRetryGeneratedMediaBatch\(\{/);
    assert.match(retryNodeSource, /generateImage,/);
    assert.match(retryNodeSource, /generateVideo: \(videoRequest\) => llmService\.generateVideo\(videoRequest\),/);
    assert.doesNotMatch(retryNodeSource, /executeRetryGeneratedMediaRequest/);
    assert.doesNotMatch(retryNodeSource, /let generatedMediaContext: RetryGeneratedMediaResultContext;/);
    assert.doesNotMatch(retryNodeSource, /prepareRetryVideoGenerationRequest/);
    assert.doesNotMatch(retryNodeSource, /buildRetryVideoGenerationResultContext/);
    assert.doesNotMatch(retryNodeSource, /prepareRetryImageGenerationRequest/);
    assert.doesNotMatch(retryNodeSource, /buildRetryImageGenerationResultContext/);
    assert.doesNotMatch(retryNodeSource, /const videoResult = await llmService\.generateVideo/);
    assert.doesNotMatch(retryNodeSource, /generateImage\([\s\S]*\.\.\.imageRequest\.args/);
    assert.match(pptSingleRetrySource, /const result = await generateImage\(/);
    assert.doesNotMatch(pptSingleRetrySource, /executeRetryGeneratedMediaRequest/);
  });

  test('retry generated media authoritative balance is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const attemptRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaAttemptRequest = useCallback'),
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
    );

    assert.match(hookSource, /applyRetryGeneratedMediaAuthoritativeBalance: \(params: ApplyRetryGeneratedMediaAuthoritativeBalanceParams\) => void;/);
    assert.match(hookSource, /const applyRetryGeneratedMediaAuthoritativeBalance = useCallback\(\(params: ApplyRetryGeneratedMediaAuthoritativeBalanceParams\): void => \{/);
    assert.match(hookSource, /typeof params\.generatedMediaContext\.balanceAfter === 'number'/);
    assert.match(hookSource, /params\.applyAuthoritativeBalance\(params\.generatedMediaContext\.balanceAfter\);/);

    assert.match(attemptRequestSource, /applyRetryGeneratedMediaAuthoritativeBalance\(\{[\s\S]*generatedMediaContext: requestResult\.generatedMediaContext,[\s\S]*applyAuthoritativeBalance: params\.applyAuthoritativeBalance,[\s\S]*\}\);/);
    assert.match(retryNodeSource, /applyAuthoritativeBalance,/);
    assert.doesNotMatch(retryNodeSource, /applyRetryGeneratedMediaAuthoritativeBalance/);
    assert.doesNotMatch(retryNodeSource, /typeof generatedMediaContext\.balanceAfter === 'number'/);
    assert.doesNotMatch(retryNodeSource, /applyAuthoritativeBalance\(generatedMediaContext\.balanceAfter\);/);
  });

  test('retry generated media result context is consolidated before result assembly', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const executeRequestSource = hookSource.slice(
      hookSource.indexOf('const executeRetryGeneratedMediaRequest = useCallback'),
      hookSource.indexOf('const applyRetryGeneratedMediaAuthoritativeBalance = useCallback'),
    );
    const assembleAttemptResultSource = hookSource.slice(
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );
    const retryAttemptsSource = hookSource.slice(
      hookSource.indexOf('const runRetryGeneratedMediaAttempts = useCallback'),
      hookSource.indexOf('const prepareGenerationDraftContext = useCallback'),
    );

    assert.match(hookSource, /export interface RetryGeneratedMediaResultContext \{/);
    assert.match(hookSource, /requestTrace: RetryGenerationSuccessDebugResult;/);
    assert.match(hookSource, /resultMetadata: RetryGeneratedMediaResultMetadata;/);

    assert.match(appSource, /import \{ useGenerationRuntime \} from '\.\/app\/useGenerationRuntime';/);
    assert.doesNotMatch(appSource, /type RetryGeneratedMediaResultContext/);
    assert.match(executeRequestSource, /let generatedMediaContext: RetryGeneratedMediaResultContext;/);
    assert.match(executeRequestSource, /generatedMediaContext = buildRetryVideoGenerationResultContext\(\{/);
    assert.match(executeRequestSource, /generatedMediaContext = buildRetryImageGenerationResultContext\(\{/);
    assert.match(assembleAttemptResultSource, /const \{ apiDurationMs, b64 \} = params\.generatedMediaContext;/);
    assert.match(retryAttemptsSource, /generatedMediaContext,/);
    assert.doesNotMatch(retryNodeSource, /generatedMediaContext,/);
    assert.doesNotMatch(retryNodeSource, /const \{ apiDurationMs, b64 \} = generatedMediaContext;/);
    assert.doesNotMatch(retryNodeSource, /let generatedMediaContext: RetryGeneratedMediaResultContext;/);
    assert.doesNotMatch(retryNodeSource, /buildRetryVideoGenerationResultContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /buildRetryImageGenerationResultContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /requestTrace,/);
    assert.doesNotMatch(retryNodeSource, /resultMetadata,/);

    assert.doesNotMatch(retryNodeSource, /let b64 = '';/);
    assert.doesNotMatch(retryNodeSource, /let requestPath: string \| undefined = undefined;/);
    assert.doesNotMatch(retryNodeSource, /let actualKeySlotId = executionNode\.keySlotId;/);
    assert.doesNotMatch(retryNodeSource, /requestTrace: \{ requestPath, requestBodyPreview, pythonSnippet \}/);
    assert.doesNotMatch(retryNodeSource, /resultMetadata: \{[\s\S]*actualKeySlotId[\s\S]*\}/);
  });

  test('retry generated media attempts batch is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const retryAttemptsSource = hookSource.slice(
      hookSource.indexOf('const runRetryGeneratedMediaAttempts = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );
    const completeBatchSource = hookSource.slice(
      hookSource.indexOf('const completeRetryGeneratedMediaBatch = useCallback'),
      hookSource.indexOf('const prepareGenerationDraftContext = useCallback'),
    );

    assert.match(hookSource, /export interface RunRetryGeneratedMediaAttemptsParams \{/);
    assert.match(hookSource, /runRetryGeneratedMediaAttempts: \(params: RunRetryGeneratedMediaAttemptsParams\) => Promise<RetryGeneratedMediaResult\[\]>;/);
    assert.match(retryAttemptsSource, /return Promise\.all\(Array\.from\(\{ length: params\.count \}\)\.map\(async \(_, index\) => \{/);
    assert.match(retryAttemptsSource, /const \{ currentMode, taskPrompt, generatedMediaContext \} = await executeRetryGeneratedMediaAttemptRequest\(\{/);
    assert.match(retryAttemptsSource, /const generatedResult = await assembleRetryGeneratedMediaAttemptResult\(\{/);
    assert.match(retryAttemptsSource, /return generatedResult;/);
    assert.doesNotMatch(retryAttemptsSource, /commitRetryGeneratedMediaSuccess|addImageNodes|prepareRetryGeneratedMediaSuccessCommitContext|prepareRetryGeneratedMediaAttemptContext|runRetryGeneratedMediaAttemptWithGuard|executeRetryGeneratedMediaRequest|applyRetryGeneratedMediaAuthoritativeBalance/);

    assert.match(completeBatchSource, /const results = await runRetryGeneratedMediaAttempts\(\{/);
    assert.match(retryNodeSource, /count,/);
    assert.match(retryNodeSource, /currentNodeId,/);
    assert.match(retryNodeSource, /executionNode,/);
    assert.match(retryNodeSource, /timeoutMs: GENERATE_TIMEOUT_MS,/);
    assert.match(retryNodeSource, /generateImage,/);
    assert.match(retryNodeSource, /generateVideo: \(videoRequest\) => llmService\.generateVideo\(videoRequest\),/);
    assert.match(retryNodeSource, /sourcePrompt: node\.prompt,/);
    assert.doesNotMatch(retryNodeSource, /const \{ requestId, timeoutGuard \} = prepareRetryGeneratedMediaAttemptContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /const \{ currentMode, taskPrompt \} = prepareRetryGenerationTaskPromptContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /runRetryGeneratedMediaAttemptWithGuard\(\{/);
    assert.doesNotMatch(retryNodeSource, /executeRetryGeneratedMediaRequest\(\{/);
    assert.doesNotMatch(retryNodeSource, /applyRetryGeneratedMediaAuthoritativeBalance\(\{/);
    assert.doesNotMatch(retryNodeSource, /assembleRetryGeneratedMediaAttemptResult\(\{/);
  });

  test('retry generated media attempt result assembly is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const assembleAttemptResultSource = hookSource.slice(
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );
    const retryAttemptsSource = hookSource.slice(
      hookSource.indexOf('const runRetryGeneratedMediaAttempts = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );
    const completeBatchSource = hookSource.slice(
      hookSource.indexOf('const completeRetryGeneratedMediaBatch = useCallback'),
      hookSource.indexOf('const prepareGenerationDraftContext = useCallback'),
    );

    assert.match(hookSource, /export interface AssembleRetryGeneratedMediaAttemptResultParams \{/);
    assert.match(hookSource, /assembleRetryGeneratedMediaAttemptResult: \(params: AssembleRetryGeneratedMediaAttemptResultParams\) => Promise<RetryGeneratedMediaResult>;/);
    assert.match(assembleAttemptResultSource, /const \{ apiDurationMs, b64 \} = params\.generatedMediaContext;/);
    assert.match(assembleAttemptResultSource, /const mediaPersistence = await prepareRetryGeneratedMediaPersistence\(\{/);
    assert.match(assembleAttemptResultSource, /scheduleRetryGeneratedMediaCloudSync\(\{/);
    assert.match(assembleAttemptResultSource, /const generationTime = resolveRetryGeneratedMediaGenerationTime\(\{/);
    assert.match(assembleAttemptResultSource, /const mediaDimensions = await resolveRetryGeneratedMediaDimensions\(\{/);
    assert.match(assembleAttemptResultSource, /const generatedResult = buildRetryGeneratedMediaResultFromContext\(\{/);
    assert.match(assembleAttemptResultSource, /return generatedResult;/);
    assert.doesNotMatch(assembleAttemptResultSource, /addImageNodes|commitRetryGeneratedMediaSuccess|reportRetryGenerationSuccess|applyRetryGeneratedMediaAuthoritativeBalance/);

    assert.match(retryAttemptsSource, /const generatedResult = await assembleRetryGeneratedMediaAttemptResult\(\{/);
    assert.match(retryAttemptsSource, /buildPptPageAlias: params\.buildPptPageAlias,/);
    assert.match(retryAttemptsSource, /canvasId: params\.canvasId,/);
    assert.match(retryAttemptsSource, /generatedMediaContext,/);
    assert.match(retryAttemptsSource, /normalizePersistableMediaSource: params\.normalizePersistableMediaSource,/);
    assert.match(retryAttemptsSource, /saveOriginalImage: params\.saveOriginalImage,/);
    assert.match(retryAttemptsSource, /startedAtMs: params\.startedAtMs,/);
    assert.match(retryAttemptsSource, /prompt: taskPrompt,/);
    assert.match(retryNodeSource, /buildPptPageAlias,/);
    assert.match(retryNodeSource, /canvasId: activeCanvasRef\.current\?\.id,/);
    assert.match(retryNodeSource, /normalizePersistableMediaSource,/);
    assert.match(retryNodeSource, /saveOriginalImage,/);
    assert.match(completeBatchSource, /startedAtMs,/);
    assert.doesNotMatch(retryNodeSource, /startedAtMs: startTime,/);
    assert.doesNotMatch(retryNodeSource, /assembleRetryGeneratedMediaAttemptResult\(\{/);
    assert.doesNotMatch(retryNodeSource, /const \{ apiDurationMs, b64 \} = generatedMediaContext;/);
    assert.doesNotMatch(retryNodeSource, /const mediaPersistence = await prepareRetryGeneratedMediaPersistence\(\{/);
    assert.doesNotMatch(retryNodeSource, /const generationTime = resolveRetryGeneratedMediaGenerationTime\(\{/);
    assert.doesNotMatch(retryNodeSource, /const mediaDimensions = await resolveRetryGeneratedMediaDimensions\(\{/);
  });

  test('retry generated media timing is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const assembleAttemptResultSource = hookSource.slice(
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );
    const completeBatchSource = hookSource.slice(
      hookSource.indexOf('const completeRetryGeneratedMediaBatch = useCallback'),
      hookSource.indexOf('const prepareGenerationDraftContext = useCallback'),
    );

    assert.match(hookSource, /resolveRetryGeneratedMediaGenerationTime: \(params: ResolveRetryGeneratedMediaGenerationTimeParams\) => number;/);
    assert.match(hookSource, /const resolveRetryGeneratedMediaGenerationTime = useCallback\(\(params: ResolveRetryGeneratedMediaGenerationTimeParams\): number => \{/);
    assert.match(hookSource, /return clampGenerationDurationMs\(/);
    assert.match(hookSource, /apiDurationMs && apiDurationMs > 0/);

    assert.match(assembleAttemptResultSource, /const generationTime = resolveRetryGeneratedMediaGenerationTime\(\{/);
    assert.match(assembleAttemptResultSource, /apiDurationMs,/);
    assert.match(assembleAttemptResultSource, /startedAtMs: params\.startedAtMs,/);
    assert.match(completeBatchSource, /const startedAtMs = Date\.now\(\);/);
    assert.match(completeBatchSource, /startedAtMs,/);
    assert.doesNotMatch(retryNodeSource, /startedAtMs: startTime,/);
    assert.doesNotMatch(retryNodeSource, /const generationTime = resolveRetryGeneratedMediaGenerationTime\(\{/);
    assert.doesNotMatch(retryNodeSource, /const generationTime = clampGenerationDurationMs\(/);
    assert.doesNotMatch(retryNodeSource, /Date\.now\(\) - startTime/);
  });

  test('retry generated media persistence context is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const assembleAttemptResultSource = hookSource.slice(
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );

    assert.match(hookSource, /prepareRetryGeneratedMediaPersistence: \(params: PrepareRetryGeneratedMediaPersistenceParams\) => Promise<PrepareRetryGeneratedMediaPersistenceResult>;/);
    assert.match(hookSource, /const prepareRetryGeneratedMediaPersistence = useCallback/);
    assert.match(hookSource, /Promise<PrepareRetryGeneratedMediaPersistenceResult> => \{/);
    assert.match(hookSource, /const normalizedOriginalSource = params\.normalizePersistableMediaSource\(/);
    assert.match(hookSource, /const storageId = await params\.calculateImageHash\(normalizedOriginalSource \|\| url\);/);
    assert.match(hookSource, /void params\.saveOriginalImage\(storageId, normalizedOriginalSource\)\.catch\(\(\) => undefined\);/);
    assert.match(hookSource, /const mimeType = params\.currentMode === GenerationMode\.VIDEO \? 'video\/mp4' : 'image\/png';/);

    assert.match(assembleAttemptResultSource, /const mediaPersistence = await prepareRetryGeneratedMediaPersistence\(\{/);
    assert.match(retryNodeSource, /normalizePersistableMediaSource,/);
    assert.match(retryNodeSource, /calculateImageHash,/);
    assert.match(retryNodeSource, /saveOriginalImage,/);
    assert.doesNotMatch(retryNodeSource, /const mediaPersistence = await prepareRetryGeneratedMediaPersistence\(\{/);
    assert.doesNotMatch(retryNodeSource, /const normalizedOriginalSource = normalizePersistableMediaSource\(/);
    assert.doesNotMatch(retryNodeSource, /const storageId = await calculateImageHash\(normalizedOriginalSource \|\| url\);/);
    assert.doesNotMatch(retryNodeSource, /void saveOriginalImage\(storageId, normalizedOriginalSource\)\.catch\(\(\) => undefined\);/);
  });

  test('retry generated media dimension detection is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const assembleAttemptResultSource = hookSource.slice(
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );

    assert.match(hookSource, /resolveRetryGeneratedMediaDimensions: \(params: ResolveRetryGeneratedMediaDimensionsParams\) => Promise<ResolveRetryGeneratedMediaDimensionsResult>;/);
    assert.match(hookSource, /const resolveRetryGeneratedMediaDimensions = useCallback/);
    assert.match(hookSource, /Promise<ResolveRetryGeneratedMediaDimensionsResult> => \{/);
    assert.match(hookSource, /let actualWidth = 1024;/);
    assert.match(hookSource, /const bitmap = await createImageBitmap\(blob\);/);
    assert.match(hookSource, /const maxDim = Math\.max\(actualWidth, actualHeight\);/);
    assert.match(hookSource, /computedImageSize = ImageSize\.SIZE_4K;/);

    assert.match(assembleAttemptResultSource, /const mediaDimensions = await resolveRetryGeneratedMediaDimensions\(\{/);
    assert.match(assembleAttemptResultSource, /executionNode: params\.executionNode,/);
    assert.match(assembleAttemptResultSource, /url: mediaPersistence\.url,/);
    assert.doesNotMatch(retryNodeSource, /const mediaDimensions = await resolveRetryGeneratedMediaDimensions\(\{/);
    assert.doesNotMatch(retryNodeSource, /let actualWidth = 1024;/);
    assert.doesNotMatch(retryNodeSource, /const bitmap = await createImageBitmap\(blob\);/);
    assert.doesNotMatch(retryNodeSource, /const maxDim = Math\.max\(actualWidth, actualHeight\);/);
  });

  test('retry generated media cloud sync scheduling is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const assembleAttemptResultSource = hookSource.slice(
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
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

    assert.match(assembleAttemptResultSource, /scheduleRetryGeneratedMediaCloudSync\(\{/);
    assert.match(assembleAttemptResultSource, /currentMode: params\.currentMode,/);
    assert.match(assembleAttemptResultSource, /index: params\.index,/);
    assert.doesNotMatch(retryNodeSource, /scheduleRetryGeneratedMediaCloudSync\(\{/);
    assert.doesNotMatch(retryNodeSource, /import\('\.\/services\/system\/syncService'\)/);
    assert.doesNotMatch(retryNodeSource, /await syncService\.uploadImagePair\(id, blob\);/);
    assert.doesNotMatch(retryNodeSource, /Already captured in mediaPersistence for persisted result metadata/);
  });

  test('retry generated media result assembly is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const assembleAttemptResultSource = hookSource.slice(
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );

    assert.match(hookSource, /buildRetryGeneratedMediaResult: \(params: BuildRetryGeneratedMediaResultParams\) => RetryGeneratedMediaResult;/);
    assert.match(hookSource, /const buildRetryGeneratedMediaResult = useCallback\(\(params: BuildRetryGeneratedMediaResultParams\): RetryGeneratedMediaResult => \{/);
    assert.match(hookSource, /canvasId: params\.canvasId \|\| 'default',/);
    assert.match(hookSource, /dimensions: params\.mediaDimensions\.displayDimensions,/);
    assert.match(hookSource, /const sourceReferenceStorageIds = \(params\.executionNode\.referenceImages \|\| \[\]\)[\s\S]*\.map/);
    assert.match(hookSource, /id: `\$\{Date\.now\(\)\}_\$\{params\.index\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 5\)\}`/);
    assert.match(hookSource, /mimeType: params\.mediaPersistence\.mimeType,/);

    assert.match(assembleAttemptResultSource, /const generatedResult = buildRetryGeneratedMediaResultFromContext\(\{/);
    assert.match(assembleAttemptResultSource, /mediaDimensions,/);
    assert.match(assembleAttemptResultSource, /mediaPersistence,/);
    assert.match(assembleAttemptResultSource, /canvasId: params\.canvasId,/);
    assert.match(assembleAttemptResultSource, /return generatedResult;/);
    assert.match(retryNodeSource, /canvasId: activeCanvasRef\.current\?\.id,/);
    assert.doesNotMatch(retryNodeSource, /const generatedResult = buildRetryGeneratedMediaResultFromContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /const generatedResult = buildRetryGeneratedMediaResult\(\{/);
    assert.doesNotMatch(retryNodeSource, /canvasId: activeCanvas\?\.id,/);
    assert.doesNotMatch(retryNodeSource, /sourceReferenceStorageIds: \(executionNode\.referenceImages \|\| \[\]\)\.map/);
    assert.doesNotMatch(retryNodeSource, /id: `\$\{Date\.now\(\)\}_\$\{index\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 5\)\}`/);
  });

  test('retry generated media result assembly uses the consolidated context boundary', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const assembleAttemptResultSource = hookSource.slice(
      hookSource.indexOf('const assembleRetryGeneratedMediaAttemptResult = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );
    const retryAttemptsSource = hookSource.slice(
      hookSource.indexOf('const runRetryGeneratedMediaAttempts = useCallback'),
      hookSource.indexOf('const resolveRetryGeneratedMediaLayoutPrompt = useCallback'),
    );

    assert.match(hookSource, /buildRetryGeneratedMediaResultFromContext: \(params: BuildRetryGeneratedMediaResultFromContextParams\) => RetryGeneratedMediaResult;/);
    assert.match(hookSource, /const buildRetryGeneratedMediaResultFromContext = useCallback\(\(params: BuildRetryGeneratedMediaResultFromContextParams\): RetryGeneratedMediaResult => \{/);
    assert.match(hookSource, /alias: params\.currentMode === GenerationMode\.PPT \? params\.buildPptPageAlias/);
    assert.match(hookSource, /requestTrace: params\.generatedMediaContext\.requestTrace,/);
    assert.match(hookSource, /resultMetadata: params\.generatedMediaContext\.resultMetadata,/);

    assert.match(assembleAttemptResultSource, /const generatedResult = buildRetryGeneratedMediaResultFromContext\(\{/);
    assert.match(assembleAttemptResultSource, /generatedMediaContext: params\.generatedMediaContext,/);
    assert.match(retryAttemptsSource, /generatedMediaContext,/);
    assert.doesNotMatch(retryNodeSource, /generatedMediaContext,/);
    assert.doesNotMatch(retryNodeSource, /const generatedResult = buildRetryGeneratedMediaResultFromContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /const generatedResult = buildRetryGeneratedMediaResult\(\{/);
    assert.doesNotMatch(retryNodeSource, /alias: currentMode === GenerationMode\.PPT \? buildPptPageAlias/);
    assert.doesNotMatch(retryNodeSource, /requestTrace,/);
    assert.doesNotMatch(retryNodeSource, /resultMetadata,/);
  });

  test('retry completed prompt patch assembly is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const commitBatchSuccessSource = hookSource.slice(
      hookSource.indexOf('const commitRetryGeneratedMediaBatchSuccess = useCallback'),
      hookSource.indexOf('const completeRetryGeneratedMediaBatch = useCallback'),
    );

    assert.match(hookSource, /buildRetryCompletedPromptPatch: \(params: BuildRetryCompletedPromptPatchParams\) => Partial<PromptNode>;/);
    assert.match(hookSource, /const buildRetryCompletedPromptPatch = useCallback\(\(params: BuildRetryCompletedPromptPatchParams\): Partial<PromptNode> => \{/);
    assert.match(hookSource, /childImageIds: params\.alignedImageNodes\.map\(n => n\.id\),/);
    assert.match(hookSource, /\.\.\.buildCompletedPromptNodePatch\(\),/);
    assert.match(hookSource, /modelLabel: params\.resolveModelDisplayName\(/);

    assert.match(commitBatchSuccessSource, /const \{ alignedImageNodes, retryCompletedPromptPatch \} = prepareRetryGeneratedMediaSuccessCommitContext\(\{/);
    assert.match(commitBatchSuccessSource, /commitRetryGeneratedMediaSuccess\(\{[\s\S]*retryCompletedPromptPatch,[\s\S]*\}\);/);
    assert.match(retryNodeSource, /await completeRetryGeneratedMediaBatch\(\{/);
    assert.doesNotMatch(retryNodeSource, /childImageIds: alignedImageNodes\.map\(n => n\.id\),/);
    assert.doesNotMatch(retryNodeSource, /\.\.\.buildCompletedPromptNodePatch\(\),/);
    assert.doesNotMatch(retryNodeSource, /modelLabel: resolveModelDisplayName\(/);
  });

  test('retry generated media layout preparation is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );

    assert.match(hookSource, /buildRetryGeneratedMediaLayout: \(params: BuildRetryGeneratedMediaLayoutParams\) => RetryGeneratedMediaLayoutNode\[\];/);
    assert.match(hookSource, /const buildRetryGeneratedMediaLayout = useCallback\(\(params: BuildRetryGeneratedMediaLayoutParams\): RetryGeneratedMediaLayoutNode\[\] => \{/);
    assert.match(hookSource, /const newImageNodes = params\.results\.map\(\(img, i\) => \{/);
    assert.match(hookSource, /let exactImageHeight = cardHeight;/);
    assert.match(hookSource, /const generatedPositions = params\.buildGeneratedImageBatchPositions\(\{/);
    assert.match(hookSource, /basePosition: \(params\.latestLayoutPrompt \|\| params\.executionNode\)\.position \|\| params\.executionNode\.position,/);

    assert.match(retryNodeSource, /completeRetryGeneratedMediaBatch\(\{[\s\S]*buildGeneratedImageBatchPositions,[\s\S]*getCardDimensions,[\s\S]*\}\);/);
    assert.match(retryNodeSource, /buildGeneratedImageBatchPositions,/);
    assert.match(retryNodeSource, /getCardDimensions,/);
    assert.doesNotMatch(retryNodeSource, /prepareRetryGeneratedMediaSuccessCommitContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /const latestLayoutPrompt = resolveRetryGeneratedMediaLayoutPrompt\(\{/);
    assert.doesNotMatch(retryNodeSource, /const alignedImageNodes = buildRetryGeneratedMediaLayout\(\{/);
    assert.doesNotMatch(retryNodeSource, /const newImageNodes = results\.map\(\(img, i\) => \{/);
    assert.doesNotMatch(retryNodeSource, /let exactImageHeight = cardHeight;/);
    assert.doesNotMatch(retryNodeSource, /const generatedPositions = buildGeneratedImageBatchPositions\(\{/);
  });

  test('retry generated media success commit context is prepared by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const prepareSuccessCommitContextSource = hookSource.slice(
      hookSource.indexOf('const prepareRetryGeneratedMediaSuccessCommitContext = useCallback'),
      hookSource.indexOf('const commitRetryGeneratedMediaBatchSuccess = useCallback'),
    );
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );

    assert.match(hookSource, /export interface PrepareRetryGeneratedMediaSuccessCommitContextParams extends Omit</);
    assert.match(hookSource, /export interface PrepareRetryGeneratedMediaSuccessCommitContextResult \{/);
    assert.match(hookSource, /prepareRetryGeneratedMediaSuccessCommitContext: \(params: PrepareRetryGeneratedMediaSuccessCommitContextParams\) => PrepareRetryGeneratedMediaSuccessCommitContextResult;/);
    assert.match(hookSource, /const prepareRetryGeneratedMediaSuccessCommitContext = useCallback\(\(params: PrepareRetryGeneratedMediaSuccessCommitContextParams\): PrepareRetryGeneratedMediaSuccessCommitContextResult => \{/);
    assert.match(prepareSuccessCommitContextSource, /const latestLayoutPrompt = resolveRetryGeneratedMediaLayoutPrompt\(\{/);
    assert.match(prepareSuccessCommitContextSource, /const alignedImageNodes = buildRetryGeneratedMediaLayout\(\{/);
    assert.match(prepareSuccessCommitContextSource, /const retryCompletedPromptPatch = buildRetryCompletedPromptPatch\(\{/);
    assert.match(prepareSuccessCommitContextSource, /return \{\s*alignedImageNodes,\s*retryCompletedPromptPatch,\s*\};/);
    assert.doesNotMatch(prepareSuccessCommitContextSource, /addImageNodes|commitRetryGeneratedMediaSuccess|reportRetryGenerationSuccess/);
    assert.match(hookSource, /prepareRetryGeneratedMediaSuccessCommitContext,/);

    assert.match(retryNodeSource, /await completeRetryGeneratedMediaBatch\(\{/);
    assert.match(retryNodeSource, /canvasSnapshot: activeCanvasRef\.current,/);
    assert.match(retryNodeSource, /buildGeneratedImageBatchPositions,/);
    assert.match(retryNodeSource, /getCardDimensions,/);
    assert.match(retryNodeSource, /resolveModelDisplayName,/);
    assert.doesNotMatch(retryNodeSource, /prepareRetryGeneratedMediaSuccessCommitContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /resolveRetryGeneratedMediaLayoutPrompt\(\{/);
    assert.doesNotMatch(retryNodeSource, /buildRetryGeneratedMediaLayout\(\{/);
    assert.doesNotMatch(retryNodeSource, /buildRetryCompletedPromptPatch\(\{/);
  });

  test('retry generated media batch success finalization is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const commitBatchSuccessSource = hookSource.slice(
      hookSource.indexOf('const commitRetryGeneratedMediaBatchSuccess = useCallback'),
      hookSource.indexOf('const completeRetryGeneratedMediaBatch = useCallback'),
    );

    assert.match(hookSource, /export interface CommitRetryGeneratedMediaBatchSuccessParams extends Omit</);
    assert.match(hookSource, /commitRetryGeneratedMediaBatchSuccess: \(params: CommitRetryGeneratedMediaBatchSuccessParams\) => Promise<void>;/);
    assert.match(commitBatchSuccessSource, /const \{ alignedImageNodes, retryCompletedPromptPatch \} = prepareRetryGeneratedMediaSuccessCommitContext\(\{/);
    assert.match(commitBatchSuccessSource, /await commitRetryGeneratedMediaSuccess\(\{/);
    assert.match(commitBatchSuccessSource, /addImageNodes: params\.addImageNodes,/);
    assert.match(commitBatchSuccessSource, /parentNodeId: params\.parentNodeId,/);
    assert.match(commitBatchSuccessSource, /retryCompletedPromptPatch,/);
    assert.match(commitBatchSuccessSource, /alignedImageNodes,/);
    assert.doesNotMatch(commitBatchSuccessSource, /runRetryGeneratedMediaAttempts|commitRetryGenerationFailure/);

    assert.match(retryNodeSource, /await completeRetryGeneratedMediaBatch\(\{/);
    assert.match(retryNodeSource, /addImageNodes,/);
    assert.match(retryNodeSource, /parentNodeId: node\.id,/);
    assert.doesNotMatch(retryNodeSource, /results,/);
    assert.doesNotMatch(retryNodeSource, /await commitRetryGeneratedMediaBatchSuccess\(\{/);
    assert.doesNotMatch(retryNodeSource, /const \{ alignedImageNodes, retryCompletedPromptPatch \} = prepareRetryGeneratedMediaSuccessCommitContext\(\{/);
    assert.doesNotMatch(retryNodeSource, /await commitRetryGeneratedMediaSuccess\(\{/);
  });

  test('retry generated media batch transaction is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );
    const completeBatchSource = hookSource.slice(
      hookSource.indexOf('const completeRetryGeneratedMediaBatch = useCallback'),
      hookSource.indexOf('const prepareGenerationDraftContext = useCallback'),
    );

    assert.match(hookSource, /export interface CompleteRetryGeneratedMediaBatchParams extends Omit</);
    assert.match(hookSource, /completeRetryGeneratedMediaBatch: \(params: CompleteRetryGeneratedMediaBatchParams\) => Promise<void>;/);
    assert.match(hookSource, /return \{[\s\S]*completeRetryGeneratedMediaBatch,[\s\S]*\};\s*\}/);
    assert.match(hookSource, /retryBillingState: CommitRetryGenerationStartParams\['retryBillingState'\];/);
    assert.match(completeBatchSource, /commitRetryGenerationStart\(\{[\s\S]*\}\);\s*try \{/);
    assert.match(completeBatchSource, /const startedAtMs = Date\.now\(\);/);
    assert.match(completeBatchSource, /const results = await runRetryGeneratedMediaAttempts\(\{/);
    assert.match(completeBatchSource, /startedAtMs,/);
    assert.match(completeBatchSource, /await commitRetryGeneratedMediaBatchSuccess\(\{/);
    assert.match(completeBatchSource, /canvasSnapshot: params\.canvasSnapshot,/);
    assert.match(completeBatchSource, /parentNodeId: params\.parentNodeId,/);
    assert.match(completeBatchSource, /await commitRetryGenerationFailure\(\{/);
    assert.doesNotMatch(completeBatchSource, /prepareRetriedExecutionNode|recoverFailedSyncBridgeGeneration|handleRetryPptSinglePage/);

    assert.match(appSource, /const \{[\s\S]*completeRetryGeneratedMediaBatch,[\s\S]*\} = useGenerationRuntime\(\{/);
    assert.match(retryNodeSource, /await completeRetryGeneratedMediaBatch\(\{/);
    assert.match(retryNodeSource, /canvasId: activeCanvasRef\.current\?\.id,/);
    assert.match(retryNodeSource, /canvasSnapshot: activeCanvasRef\.current,/);
    assert.match(retryNodeSource, /extractErrorDetails,/);
    assert.match(retryNodeSource, /retryBillingState,/);
    assert.match(retryNodeSource, /sourcePrompt: node\.prompt,/);
    assert.match(retryNodeSource, /parentNodeId: node\.id,/);
    assert.doesNotMatch(appSource, /\bcommitRetryGenerationStart\b/);
    assert.doesNotMatch(retryNodeSource, /const startTime = Date\.now\(\);/);
    assert.doesNotMatch(retryNodeSource, /const results = await runRetryGeneratedMediaAttempts\(\{/);
    assert.doesNotMatch(retryNodeSource, /await commitRetryGeneratedMediaBatchSuccess\(\{/);
    assert.doesNotMatch(retryNodeSource, /await commitRetryGenerationFailure\(\{/);
    assert.doesNotMatch(retryNodeSource, /startedAtMs: startTime,/);
    assert.doesNotMatch(appSource, /\brunRetryGeneratedMediaAttempts\b/);
    assert.doesNotMatch(appSource, /\bcommitRetryGeneratedMediaBatchSuccess\b/);
  });

  test('retry generated media layout prompt resolution is owned by useGenerationRuntime', () => {
    const appSource = readSource('src/App.tsx');
    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const retryNodeSource = appSource.slice(
      appSource.indexOf('const handleRetryNode = useCallback'),
      appSource.indexOf(APP_RETRY_NODE_END_MARKER),
    );

    assert.match(hookSource, /export interface ResolveRetryGeneratedMediaLayoutPromptParams \{/);
    assert.match(hookSource, /canvasSnapshot\?: Pick<Canvas, 'promptNodes'> \| null;/);
    assert.match(hookSource, /resolveRetryGeneratedMediaLayoutPrompt: \(params: ResolveRetryGeneratedMediaLayoutPromptParams\) => ResolveRetryGeneratedMediaLayoutPromptResult;/);
    assert.match(hookSource, /const resolveRetryGeneratedMediaLayoutPrompt = useCallback\(\(params: ResolveRetryGeneratedMediaLayoutPromptParams\): ResolveRetryGeneratedMediaLayoutPromptResult => \{/);
    assert.match(hookSource, /params\.canvasSnapshot\?\.promptNodes\.find/);

    assert.match(retryNodeSource, /completeRetryGeneratedMediaBatch\(\{[\s\S]*canvasSnapshot: activeCanvasRef\.current,[\s\S]*\}\);/);
    assert.match(retryNodeSource, /executionNode,/);
    assert.doesNotMatch(retryNodeSource, /const latestLayoutPrompt = resolveRetryGeneratedMediaLayoutPrompt\(\{/);
    assert.doesNotMatch(retryNodeSource, /activeCanvasRef\.current\?\.promptNodes\.find/);
  });
});
