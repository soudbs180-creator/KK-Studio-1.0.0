import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('billing balance refresh still resolves remaining balance from canonical sources', () => {
  const billingContextSource = readSource('src/context/BillingContext.tsx');

  assert.match(
    billingContextSource,
    /import \{ kkWebApiClient \} from '\.\.\/services\/api\/kkApiClient';/,
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
    /const refreshPromise = \(includeTransactions\s*\?\s*Promise\.all\(\[refreshBalanceOnly\(\), loadCreditTransactions\(false\)\]\)\s*:\s*refreshBalanceOnly\(\)\.then\(\(canonicalBalance\) => \[canonicalBalance, undefined\] as const\)\)\s*\.then\(\(\[canonicalBalance, latestBalanceAfter\]\) => \{\s*const resolvedBalance = typeof canonicalBalance === 'number'\s*\?\s*canonicalBalance\s*:\s*latestBalanceAfter;/,
  );
  assert.match(
    billingContextSource,
    /const response = await kkWebApiClient\.getCreditBalance\(buildBillingRequestOptions\(apiAccessToken\)\);/,
  );
  assert.match(
    billingContextSource,
    /const response = await kkWebApiClient\.listCreditTransactions\(\s*\{ limit: CREDIT_TRANSACTIONS_FETCH_LIMIT \},\s*buildBillingRequestOptions\(apiAccessToken\),\s*\);/,
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

test('recharge modal success path refreshes canonical billing balance and transaction logs', () => {
  const rechargeModalSource = readSource('src/components/modals/RechargeModal.tsx');

  assert.match(rechargeModalSource, /const \{ showRechargeModal, setShowRechargeModal, refreshBilling \} = useBilling\(\);/);
  assert.match(
    rechargeModalSource,
    /if \(response\.data\.paymentOrderStatus === 'paid' && response\.data\.settlementApplied\) \{\s*setPaymentStatus\('success'\);\s*setPaymentMessage\('支付成功，积分已经同步到当前余额。'\);\s*await refreshBilling\(\{ includeTransactions: true \}\);/,
  );
  assert.doesNotMatch(
    rechargeModalSource,
    /if \(response\.data\.paymentOrderStatus === 'paid' && response\.data\.settlementApplied\) \{\s*setPaymentStatus\('success'\);\s*setPaymentMessage\('支付成功，积分已经同步到当前余额。'\);\s*await refreshBilling\(\);/,
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
  assert.ok(dashboardLocalizedSource.includes("'Credits & Recharge')"));
  assert.ok(dashboardLocalizedSource.includes('value: remainingBalanceDisplay'));

  assert.ok(dashboardSource.includes('selectRemainingBalanceSummary'));
  assert.match(dashboardSource, /const remainingBalanceDisplay = formatRemainingCredits\(balance, ['"][^'"]+['"]\);/);
  assert.ok(dashboardSource.includes("title: 'Credits & Recharge'"));
  assert.ok(dashboardSource.includes('value: remainingBalanceDisplay'));

  assert.ok(profileModalSource.includes("const remainingBalanceDisplay = formatRemainingCredits(balance, 'zh-CN');"));
  assert.ok(profileModalSource.includes('const remainingBalanceHint = latestRecharge'));
  assert.ok(profileModalSource.includes('个人 API 不扣积分'));
  assert.ok(profileModalSource.includes("void refreshBilling({ includeTransactions: true });"));

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
  const userApiCloudStorageShimSource = readSource('src/services/api/supabaseUserApiCloudStorage.ts');

  assert.ok(apiSettingsViewSource.includes('const providerActionsDisabled = !isAuthenticated || isHydratingRuntimeUserApis;'));
  assert.ok(apiSettingsViewSource.includes('const providerEditorReadOnly = providerActionsDisabled;'));
  assert.ok(apiSettingsViewSource.includes('const headerPrimaryActionDisabled = activeTab === \'official\' ? userApiActionsDisabled : providerActionsDisabled;'));
  assert.ok(apiSettingsViewSource.includes('disabled={headerPrimaryActionDisabled} onClick={activeTab === \'official\' ? beginCreateOfficial : beginCreateProvider}'));
  assert.ok(apiSettingsViewSource.includes('disabled={providerActionsDisabled} onClick={beginCreateProvider}'));
  assert.ok(apiSettingsViewSource.includes('disabled={providerEditorReadOnly}'));
  assert.ok(apiSettingsViewSource.includes('await upsertUserApiSlotToCloudRecord({'));
  assert.ok(apiSettingsViewSource.includes('await removeUserApiSlotFromCloudRecord(id);'));
  assert.ok(apiSettingsViewSource.includes('disabled={providerActionsDisabled} onClick={() => void saveProvider()}'));
  assert.ok(apiSettingsViewSource.includes('disabled={providerActionsDisabled} onClick={() => void deleteProvider(editingProviderId)}'));
  assert.ok(apiSettingsViewSource.includes('await upsertUserApiProviderToCloudRecord({'));
  assert.ok(apiSettingsViewSource.includes('await removeUserApiProviderFromCloudRecord(id);'));

  assert.ok(userApiCloudRecordStorageSource.includes('export async function saveUserApisPayloadToCloudRecord('));
  assert.ok(userApiCloudRecordStorageSource.includes('export async function upsertUserApiSlotToCloudRecord('));
  assert.ok(userApiCloudRecordStorageSource.includes('export async function removeUserApiSlotFromCloudRecord('));
  assert.ok(userApiCloudRecordStorageSource.includes('export async function upsertUserApiProviderToCloudRecord('));
  assert.ok(userApiCloudRecordStorageSource.includes('export async function removeUserApiProviderFromCloudRecord('));
  assert.ok(userApiCloudRecordStorageSource.includes('export async function mergeUserApisPayloadToCloudRecord('));
  assert.doesNotMatch(userApiCloudRecordStorageSource, /ViaSupabase/);
  assert.ok(userApiCloudStorageShimSource.includes('loadUserApisPayloadMetadataFromCloudRecord as loadUserApisPayloadMetadataViaSupabase'));
  assert.ok(userApiCloudStorageShimSource.includes('mergeUserApisPayloadToCloudRecord as mergeUserApisPayloadViaSupabase'));
  assert.ok(userApiCloudRecordStorageSource.includes('legacyWebApiClient.replaceUserApisPayload({'));
  assert.ok(userApiCloudRecordStorageSource.includes('legacyWebApiClient.replaceKeyManagerCloudState({'));
  assert.ok(userApiCloudRecordStorageSource.includes('legacyWebApiClient.replaceUserApiEntries({'));
  assert.ok(userApiCloudRecordStorageSource.includes("const CLIENT_VISIBLE_SECRET_PLACEHOLDER = 'sk-readonly-0000'"));
  assert.ok(userApiCloudRecordStorageSource.includes('normalized === CLIENT_VISIBLE_SECRET_PLACEHOLDER'));
  assert.doesNotMatch(userApiCloudRecordStorageSource, /\.from\('profiles'\)/);
});
