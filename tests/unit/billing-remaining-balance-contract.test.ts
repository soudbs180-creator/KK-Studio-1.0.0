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
    /const refreshPromise = Promise\.all\(\[fetchBalance\(\), loadCreditTransactions\(false\)\]\)\s*\.then\(\(\[canonicalBalance, latestBalanceAfter\]\) => \{\s*const resolvedBalance = typeof canonicalBalance === 'number'\s*\?\s*canonicalBalance\s*:\s*latestBalanceAfter;/,
  );
  assert.match(
    billingContextSource,
    /const response = await consumeCreditsDirectlyViaSupabase\(\{[\s\S]*?if \(typeof response\.newBalance === 'number'\) \{\s*setBalance\(toDisplayNumber\(response\.newBalance\)\);\s*\}\s*await loadCreditTransactions\(false\);/,
  );
  assert.match(billingContextSource, /import \{ isKkApiBillingPersistedViaSupabase \} from '\.\.\/services\/api\/kkApiServerHealth';/);
  assert.match(billingContextSource, /async function fetchBalanceDirectlyFromSupabase\(userId: string\): Promise<number \| undefined> \{/);
  assert.match(billingContextSource, /async function loadCreditTransactionsDirectlyFromSupabase\(\s*userId: string,\s*\): Promise<CreditTransactionLog\[]> \{/);
  assert.match(
    billingContextSource,
    /if \(!\(await isKkApiBillingPersistedViaSupabase\(\)\)\) \{\s*return fetchBalanceDirectlyFromSupabase\(user\.id\);\s*\}/,
  );
  assert.match(
    billingContextSource,
    /if \(!\(await isKkApiBillingPersistedViaSupabase\(\)\)\) \{\s*const rows = await loadCreditTransactionsDirectlyFromSupabase\(user\.id\);\s*applyTransactionRows\(rows\);/,
  );
  assert.doesNotMatch(billingContextSource, /total_earned/i);
  assert.doesNotMatch(billingContextSource, /total_spent/i);
});

test('billing credit mutations stay on Supabase RPCs instead of the legacy local API surface', () => {
  const billingContextSource = readSource('src/context/BillingContext.tsx');

  assert.match(billingContextSource, /async function consumeCreditsDirectlyViaSupabase\(/);
  assert.match(billingContextSource, /supabase\.rpc\('consume_credits', \{/);
  assert.match(billingContextSource, /async function refundCreditsDirectlyViaSupabase\(/);
  assert.match(billingContextSource, /supabase\.rpc\('refund_credits', \{/);
  assert.doesNotMatch(billingContextSource, /legacyWebApiClient\.debitCredits\(/);
  assert.doesNotMatch(billingContextSource, /legacyWebApiClient\.refundCredits\(/);
});

test('remaining balance display helper is shared across billing surfaces', () => {
  const helperSource = readSource('src/services/billing/remainingBalance.ts');
  const settingsPanelSource = readSource('src/components/settings/SettingsPanel.tsx');
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

  assert.ok(settingsPanelSource.includes('formatRemainingCredits'));
  assert.ok(settingsPanelSource.includes('selectRemainingBalanceSummary'));
  assert.ok(settingsPanelSource.includes("const remainingBalanceDisplay = formatRemainingCredits(balance, 'zh-CN');"));
  assert.ok(settingsPanelSource.includes("title: '积分与充值'"));
  assert.ok(settingsPanelSource.includes('value: `${remainingBalanceDisplay} 积分`'));

  assert.ok(dashboardLocalizedSource.includes('selectRemainingBalanceSummary'));
  assert.ok(dashboardLocalizedSource.includes('const remainingBalanceDisplay = formatRemainingCredits(balance, locale);'));
  assert.ok(dashboardLocalizedSource.includes("title: pick('积分与充值', 'Credits & Recharge')"));
  assert.ok(dashboardLocalizedSource.includes('value: remainingBalanceDisplay'));

  assert.ok(dashboardSource.includes('selectRemainingBalanceSummary'));
  assert.match(dashboardSource, /const remainingBalanceDisplay = formatRemainingCredits\(balance, ['"][^'"]+['"]\);/);
  assert.ok(dashboardSource.includes("title: 'Credits & Recharge'"));
  assert.ok(dashboardSource.includes('value: remainingBalanceDisplay'));

  assert.ok(profileModalSource.includes("const remainingBalanceDisplay = formatRemainingCredits(balance, 'zh-CN');"));
  assert.ok(profileModalSource.includes('积分'));
  assert.ok(profileModalSource.includes('仅管理员积分模型会消耗这里的积分，个人 API 不扣积分'));
  assert.ok(profileModalSource.includes('void refreshBilling();'));

  assert.ok(costEstimationSource.includes('const { balance, usageLogs, refreshBilling } = useBilling();'));
  assert.ok(costEstimationSource.includes('const remainingBalanceDisplay = formatRemainingCredits(balance, locale);'));
  assert.ok(costEstimationSource.includes('value={remainingBalanceDisplay}'));
  assert.ok(costEstimationSource.includes('await refreshBilling();'));

  assert.ok(mobileHeaderSource.includes("const balanceDisplay = balanceLoading ? '...' : formatRemainingCredits(balance, 'zh-CN');"));
  assert.ok(promptBarSource.includes("const remainingBalanceDisplay = formatRemainingCredits(balance, 'zh-CN');"));
  assert.ok(chatSidebarSource.includes("const remainingBalanceDisplay = formatRemainingCredits(balance, 'zh-CN');"));
});

test('user api settings keep working when local API persistence degrades to memory mode', () => {
  const apiSettingsViewSource = readSource('src/components/settings/ApiSettingsView.tsx');
  const supabaseUserApiStorageSource = readSource('src/services/api/supabaseUserApiCloudStorage.ts');

  assert.ok(apiSettingsViewSource.includes('const providerActionsDisabled = !isAuthenticated;'));
  assert.ok(apiSettingsViewSource.includes('const providerEditorReadOnly = providerActionsDisabled;'));
  assert.ok(apiSettingsViewSource.includes('const headerPrimaryActionDisabled = activeTab === \'official\' ? userApiActionsDisabled : providerActionsDisabled;'));
  assert.ok(apiSettingsViewSource.includes('disabled={headerPrimaryActionDisabled} onClick={activeTab === \'official\' ? beginCreateOfficial : beginCreateProvider}'));
  assert.ok(apiSettingsViewSource.includes('disabled={providerActionsDisabled} onClick={beginCreateProvider}'));
  assert.ok(apiSettingsViewSource.includes('disabled={providerEditorReadOnly}'));
  assert.ok(apiSettingsViewSource.includes('await upsertUserApiSlotViaSupabase({'));
  assert.ok(apiSettingsViewSource.includes('await removeUserApiSlotViaSupabase(id);'));
  assert.ok(apiSettingsViewSource.includes('disabled={providerActionsDisabled} onClick={() => void saveProvider()}'));
  assert.ok(apiSettingsViewSource.includes('disabled={providerActionsDisabled} onClick={() => void deleteProvider(editingProviderId)}'));
  assert.ok(apiSettingsViewSource.includes('await upsertUserApiProviderViaSupabase({'));
  assert.ok(apiSettingsViewSource.includes('await removeUserApiProviderViaSupabase(id);'));

  assert.ok(supabaseUserApiStorageSource.includes('async function saveUserApisPayloadDirectlyToProfile('));
  assert.ok(supabaseUserApiStorageSource.includes('export async function saveUserApisPayloadViaSupabase('));
  assert.ok(supabaseUserApiStorageSource.includes('export async function upsertUserApiSlotViaSupabase('));
  assert.ok(supabaseUserApiStorageSource.includes('export async function removeUserApiSlotViaSupabase('));
  assert.ok(supabaseUserApiStorageSource.includes('export async function upsertUserApiProviderViaSupabase('));
  assert.ok(supabaseUserApiStorageSource.includes('export async function removeUserApiProviderViaSupabase('));
  assert.ok(supabaseUserApiStorageSource.includes("normalized === 'sk-readonly-0000'"));
});
