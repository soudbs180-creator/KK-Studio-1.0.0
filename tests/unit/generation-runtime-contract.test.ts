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
});
