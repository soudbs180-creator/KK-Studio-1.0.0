import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('billing balance refresh still resolves remaining balance from canonical sources', () => {
  const billingContextSource = readSource('src/context/BillingContext.tsx');

  assert.match(
    billingContextSource,
    /import \{ kkWebApiClient \} from '\.\.\/services\/api\/kkApiClient';/,
  );
  assert.match(
    billingContextSource,
    /import \{ resolveBillingRefreshMode \} from '\.\.\/services\/billing\/billingRefreshMode';/,
  );
  assert.match(
    billingContextSource,
    /function sortCreditLogs\(rows: CreditTransactionLog\[\]\): CreditTransactionLog\[\] \{\s*return \[\.\.\.rows\]\.sort\(\(left, right\) => Date\.parse\(right\.created_at\) - Date\.parse\(left\.created_at\)\);\s*\}/,
  );
  assert.match(
    billingContextSource,
    /function extractLatestBalanceAfter\(rows: CreditTransactionLog\[\]\): number \| undefined \{\s*for \(const row of rows\) \{\s*if \(typeof row\.balance_after === 'number' && Number\.isFinite\(row\.balance_after\)\) \{\s*return toDisplayNumber\(row\.balance_after\);\s*\}\s*\}\s*return undefined;\s*\}/,
  );
  assert.match(
    billingContextSource,
    /const rows = sortCreditLogs\(\(response\.data\.items \|\| \[\]\)\.map\(\(item\) => mapCreditTransaction\(item\)\)\);/,
  );
  assert.match(billingContextSource, /applyTransactionRows\(rows\);/);
  assert.match(
    billingContextSource,
    /const latestBalanceAfter = extractLatestBalanceAfter\(rows\);\s*if \(updateBalance && typeof latestBalanceAfter === 'number'\) \{\s*setBalance\(latestBalanceAfter\);\s*\}\s*return latestBalanceAfter;/,
  );
  assert.match(
    billingContextSource,
    /const includeTransactions = options\?\.includeTransactions !== false;/,
  );
  assert.match(
    billingContextSource,
    /const refreshMode = resolveBillingRefreshMode\(\{\s*silent: options\?\.silent === true,\s*hasVisibleBillingSeed,\s*\}\);/,
  );
  assert.match(
    billingContextSource,
    /if \(!canStartBillingBootstrap\) \{\s*return;\s*\}/,
  );
  assert.match(
    billingContextSource,
    /const refreshPromise: Promise<void> = \(includeTransactions\s*\?\s*Promise\.all\(\[refreshBalanceOnly\(\), loadCreditTransactions\(false\)\]\)\s*:\s*refreshBalanceOnly\(\)\.then\(\(canonicalBalance\) => \[canonicalBalance, undefined\] as \[number \| undefined, number \| undefined\]\)\)\s*\.then\(\(\[canonicalBalance, latestBalanceAfter\]\) => \{\s*const resolvedBalance = typeof canonicalBalance === 'number'\s*\?\s*canonicalBalance\s*:\s*latestBalanceAfter;/,
  );
  assert.match(
    billingContextSource,
    /const response = await kkWebApiClient\.getCreditBalance\(\);/,
  );
  assert.match(
    billingContextSource,
    /const response = await kkWebApiClient\.listCreditTransactions\(\s*\{ limit: CREDIT_TRANSACTIONS_FETCH_LIMIT \},\s*\);/,
  );
  assert.match(
    billingContextSource,
    /void refreshBilling\(\{\s*includeTransactions: true,\s*silent: true,\s*\}\);/,
  );
  assert.match(
    billingContextSource,
    /void refreshBilling\(\{\s*includeTransactions: false,\s*silent: true,\s*\}\);/,
  );
  assert.match(
    billingContextSource,
    /const intervalId = window\.setInterval\(\(\) => \{\s*triggerRefresh\(\);\s*\},\s*BILLING_SYNC_POLL_MS\);/,
  );
  assert.doesNotMatch(billingContextSource, /import \{ supabase \} from '\.\.\/lib\/supabase';/);
  assert.doesNotMatch(billingContextSource, /\.from\('user_credits'\)/);
  assert.doesNotMatch(billingContextSource, /\.from\('credit_transactions'\)/);
  assert.doesNotMatch(billingContextSource, /total_earned/i);
  assert.doesNotMatch(billingContextSource, /total_spent/i);
});

test('billing credit mutations stay on the shared web API surface', () => {
  const billingContextSource = readSource('src/context/BillingContext.tsx');

  assert.match(billingContextSource, /const response = await kkWebApiClient\.debitCredits\(\{/);
  assert.match(billingContextSource, /transactionId: response\.data\.ledgerId,/);
  assert.match(billingContextSource, /const response = await kkWebApiClient\.refundCredits\(\{/);
  assert.doesNotMatch(billingContextSource, /supabase\.rpc\('consume_credits', \{/);
  assert.doesNotMatch(billingContextSource, /supabase\.rpc\('refund_credits', \{/);
});

test('manual recharge paid success path refreshes canonical billing balance and transaction logs', () => {
  const rechargeModalSource = readSource('src/components/modals/RechargeModal.tsx');

  assert.match(rechargeModalSource, /const \{ showRechargeModal, setShowRechargeModal, refreshBilling \} = useBilling\(\);/);
  assert.match(
    rechargeModalSource,
    /const paidResponse = await markRechargeSubmissionPaid\([\s\S]*?const nextBill(?:Snapshot)? = normalizeRechargeBillSnapshot\(\{ submission: paidResponse\.data\.submission \},[\s\S]*?setBillSnapshot\(nextBill(?:Snapshot)?\);[\s\S]*?await refreshBilling\(\{ includeTransactions: true \}\);/,
  );
  const handleMarkPaidIndex = rechargeModalSource.indexOf('const handleMarkPaid = async () => {');
  const handleCreateOrderIndex = rechargeModalSource.indexOf('const baseAmount =', handleMarkPaidIndex);
  const handleMarkPaidSource = rechargeModalSource.slice(handleMarkPaidIndex, handleCreateOrderIndex);
  assert.ok(handleMarkPaidIndex >= 0);
  assert.doesNotMatch(handleMarkPaidSource, /submitRechargeProof\(/);
  assert.doesNotMatch(
    rechargeModalSource,
    /paymentOrderStatus === 'paid'/,
  );
});

test('remaining balance display helper is shared across billing surfaces', () => {
  const helperSource = readSource('src/services/billing/remainingBalance.ts');
  const dashboardLocalizedSource = readSource('src/components/settings/views/DashboardView.localized.tsx');
  const dashboardSource = readSource('src/components/settings/views/DashboardView.tsx');
  const profileModalSource = readSource('src/components/modals/UserProfileModal.tsx');
  const costEstimationSource = readSource('src/pages/CostEstimation.tsx');
  const mobileHeaderSource = readSource('src/components/mobile/MobileHeader.tsx');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const chatSidebarSource = readSource('src/components/layout/ChatSidebar.tsx');

  assert.match(helperSource, /export function normalizeRemainingCredits\(balance: unknown\): number \{/);
  assert.match(helperSource, /export function getRemainingCreditsFractionDigits\(balance: unknown\): number \{/);
  assert.match(helperSource, /export function formatRemainingCredits\(balance: unknown, locale = 'zh-CN'\): string \{/);

  assert.ok(dashboardLocalizedSource.includes('selectRemainingBalanceSummary'));
  assert.ok(dashboardLocalizedSource.includes("const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, locale);"));
  assert.ok(dashboardLocalizedSource.includes('title: pick('));
  assert.ok(dashboardLocalizedSource.includes("'Balance and recharge')"));
  assert.ok(dashboardLocalizedSource.includes('value: remainingBalanceDisplay'));

  assert.ok(dashboardSource.includes('selectRemainingBalanceSummary'));
  assert.match(dashboardSource, /const remainingBalanceDisplay = formatRemainingCredits\(balance, ['"][^'"]+['"]\);/);
  assert.ok(dashboardSource.includes("title: 'Credits & Recharge'"));
  assert.ok(dashboardSource.includes('value: remainingBalanceDisplay'));

  assert.ok(profileModalSource.includes("const remainingBalanceDisplay = formatRemainingCredits(balance, 'zh-CN');"));
  assert.ok(profileModalSource.includes('const remainingBalanceHint = latestRecharge'));
  assert.ok(profileModalSource.includes('个人 API 不扣积分'));
  assert.ok(profileModalSource.includes("void refreshBilling({ includeTransactions: true });"));
  assert.match(mobileHeaderSource, /data-testid="mobile-header-credit-chip"/);
  assert.match(mobileHeaderSource, /whitespace-nowrap/);
  assert.doesNotMatch(mobileHeaderSource, /flex-col items-start justify-center/);

  assert.ok(costEstimationSource.includes('const { balance, loading: billingLoading, usageLogs, refreshBilling, fetchLogs } = useBilling();'));
  assert.ok(costEstimationSource.includes("const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, locale);"));
  assert.ok(costEstimationSource.includes('value={remainingBalanceDisplay}'));
  assert.ok(costEstimationSource.includes('await refreshBilling();'));

  assert.ok(mobileHeaderSource.includes("const balanceDisplay = balanceLoading ? '...' : formatRemainingCredits(balance, 'zh-CN');"));
  assert.ok(promptBarSource.includes("const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, 'zh-CN');"));
  assert.ok(chatSidebarSource.includes("const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, 'zh-CN');"));
});

test('user api settings keep working when local API persistence degrades to memory mode', () => {
  const apiSettingsViewSource = readSource('src/components/settings/ApiSettingsView.tsx');
  const userApiCloudRecordStorageSource = readSource('src/services/api/userApiCloudRecordStorage.ts');
  const userApiPayloadSource = readSource('src/services/api/userApiPayload.ts');
  const shimPath = path.join(ROOT_DIR, 'apps/web/src/services/api/supabaseUserApiCloudStorage.ts');

  assert.ok(apiSettingsViewSource.includes('const providerActionsDisabled = userApiViewState.providerActionsDisabled;'));
  assert.ok(apiSettingsViewSource.includes('const providerEditorReadOnly = userApiViewState.providerEditorReadOnly;'));
  assert.ok(apiSettingsViewSource.includes('const stagePrimaryActionIcon = stageMeta.primaryActionKind === \'create-official\' || stageMeta.primaryActionKind === \'create-provider\''));
  assert.ok(apiSettingsViewSource.includes('const handleStagePrimaryAction = () => {'));
  assert.ok(apiSettingsViewSource.includes('onPrimaryAction={handleStagePrimaryAction}'));
  assert.ok(apiSettingsViewSource.includes('data-testid="api-official-provider-add"'));
  assert.ok(apiSettingsViewSource.includes('disabled={userApiActionsDisabled}'));
  assert.ok(apiSettingsViewSource.includes('onClick={handleCreateOfficialAction}'));
  assert.doesNotMatch(apiSettingsViewSource, /data-testid="api-official-empty-create"/);
  assert.ok(apiSettingsViewSource.includes('disabled={providerActionsDisabled} onClick={beginCreateProvider}'));
  assert.ok(apiSettingsViewSource.includes('disabled={providerEditorReadOnly}'));
  assert.ok(apiSettingsViewSource.includes('await upsertUserApiSlotToCloudRecord({'));
  assert.ok(apiSettingsViewSource.includes('await removeUserApiSlotFromCloudRecord(id);'));
  assert.ok(apiSettingsViewSource.includes('<PrimaryButton disabled={providerActionsDisabled || Boolean(providerEditorValidationMessage)} onClick={() => void saveProvider()}'));
  assert.ok(apiSettingsViewSource.includes('<DangerButton disabled={providerActionsDisabled} onClick={() => void deleteProvider(editingProviderId)}'));
  assert.ok(apiSettingsViewSource.includes('await upsertUserApiProviderToCloudRecord({'));
  assert.ok(apiSettingsViewSource.includes('await removeUserApiProviderFromCloudRecord(id);'));

  assert.ok(userApiCloudRecordStorageSource.includes('export async function saveUserApisPayloadToCloudRecord('));
  assert.ok(userApiCloudRecordStorageSource.includes('export async function upsertUserApiSlotToCloudRecord('));
  assert.ok(userApiCloudRecordStorageSource.includes('export async function removeUserApiSlotFromCloudRecord('));
  assert.ok(userApiCloudRecordStorageSource.includes('export async function upsertUserApiProviderToCloudRecord('));
  assert.ok(userApiCloudRecordStorageSource.includes('export async function removeUserApiProviderFromCloudRecord('));
  assert.ok(userApiCloudRecordStorageSource.includes('export async function mergeUserApisPayloadToCloudRecord('));
  assert.doesNotMatch(userApiCloudRecordStorageSource, /ViaSupabase/);
  assert.equal(existsSync(shimPath), false);
  assert.ok(userApiCloudRecordStorageSource.includes('legacyWebApiClient.replaceUserApisPayload({'));
  assert.ok(userApiCloudRecordStorageSource.includes('legacyWebApiClient.replaceKeyManagerCloudState({'));
  assert.ok(userApiCloudRecordStorageSource.includes('legacyWebApiClient.replaceUserApiEntries({'));
  assert.ok(userApiCloudRecordStorageSource.includes("const CLIENT_VISIBLE_SECRET_PLACEHOLDER = 'sk-readonly-0000'"));
  assert.ok(userApiCloudRecordStorageSource.includes('normalized === CLIENT_VISIBLE_SECRET_PLACEHOLDER'));
  assert.doesNotMatch(userApiPayloadSource, /const CLIENT_VISIBLE_SECRET_PLACEHOLDER/);
  assert.doesNotMatch(userApiPayloadSource, /const REDACTED_SECRET_PREFIX/);
  assert.doesNotMatch(userApiCloudRecordStorageSource, /\.from\('profiles'\)/);
});
