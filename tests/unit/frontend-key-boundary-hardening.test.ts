import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('keyManager blocks browser-side provider diagnostics and anonymous/local secret persistence', () => {
  const source = readSource('src/services/auth/keyManager.ts');
  const storageSource = readSource('src/services/auth/keyManagerStorage.ts');

  assert.match(storageSource, /const LEGACY_API_KEYS_STORAGE_KEY = "kk-api-keys-local";/);
  assert.match(storageSource, /const USER_API_LOGIN_REQUIRED_MESSAGE = "Sign in before adding or updating BYOK providers\. Browser-side key storage is disabled for security\.";/);
  assert.match(storageSource, /const BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE = "Browser-side provider diagnostics are disabled\. Save the key to your account and use the server-side secure proxy path instead\.";/);
  assert.match(storageSource, /type ProviderStorageScope = "anonymous" \| "user" \| "cloud" \| "none";/);
  assert.match(storageSource, /function isBrowserRuntime\(\): boolean \{/);
  assert.match(storageSource, /function createBrowserDirectProviderChecksDisabledError\(\): Error \{/);
  assert.match(source, /private purgeAnonymousSensitiveLocalCaches\(\): void \{/);
  assert.match(storageSource, /localStorage\.removeItem\(LEGACY_API_KEYS_STORAGE_KEY\);/);
  assert.match(storageSource, /localStorage\.removeItem\(STORAGE_KEY\);/);
  assert.match(storageSource, /localStorage\.removeItem\(PROVIDERS_STORAGE_KEY\);/);
  assert.match(source, /purgeAnonymousSensitiveLocalCaches\(\);/);
  assert.match(source, /private ensureAuthenticatedUserApiMode\(\): string \| null \{/);
  assert.match(source, /return USER_API_LOGIN_REQUIRED_MESSAGE;/);
  assert.match(source, /private getBrowserDirectProviderChecksDisabledMessage\(\): string \{/);
  assert.match(source, /console\.warn\('\[KeyManager\] Anonymous local key storage is disabled\.'\);/);
  assert.match(source, /async testChannel\([\s\S]*?if \(isBrowserRuntime\(\)\) \{\s*return \{\s*success: false,\s*message: this\.getBrowserDirectProviderChecksDisabledMessage\(\),\s*\};\s*\}/);
  assert.match(source, /async fetchRemoteModels\([\s\S]*?if \(isBrowserRuntime\(\)\) \{\s*console\.warn\('\[KeyManager\] Browser-side remote model discovery is disabled\.'\);\s*return \[\];\s*\}/);
  assert.match(source, /async validateKey\([\s\S]*?if \(isBrowserRuntime\(\)\) \{\s*return \{\s*valid: false,\s*error: this\.getBrowserDirectProviderChecksDisabledMessage\(\),\s*\};\s*\}/);
  assert.match(source, /async refreshKey\(id: string\): Promise<void> \{\s*if \(isBrowserRuntime\(\)\) \{\s*console\.warn\('\[KeyManager\] Browser-side key refresh is disabled\.'\);\s*return;\s*\}/);
  assert.match(source, /async revalidateAll\(\): Promise<void> \{\s*if \(isBrowserRuntime\(\)\) \{\s*console\.warn\('\[KeyManager\] Browser-side key revalidation is disabled\.'\);\s*return;\s*\}/);
  assert.match(source, /async syncProviderPricingDetailed\([\s\S]*?if \(isBrowserRuntime\(\)\) \{\s*return \{\s*ok: false,\s*message: this\.getBrowserDirectProviderChecksDisabledMessage\(\),\s*\};\s*\}/);
  assert.match(source, /async addKey\(key: string, options\?: \{[\s\S]*?const secureModeError = this\.ensureAuthenticatedUserApiMode\(\);\s*if \(secureModeError\) \{\s*return \{ success: false, error: secureModeError \};\s*\}/);
  assert.match(source, /async updateKey\(id: string, updates: Partial<KeySlot>\): Promise<void> \{\s*const secureModeError = this\.ensureAuthenticatedUserApiMode\(\);\s*if \(secureModeError\) \{\s*throw new Error\(secureModeError\);\s*\}/);
  assert.match(source, /addProvider\(config: Omit<ThirdPartyProvider, 'id' \| 'usage' \| 'status' \| 'createdAt' \| 'updatedAt'>\): ThirdPartyProvider \{\s*const secureModeError = this\.ensureAuthenticatedUserApiMode\(\);\s*if \(secureModeError\) \{\s*throw new Error\(secureModeError\);\s*\}/);
  assert.match(source, /updateProvider\(id: string, updates: Partial<Omit<ThirdPartyProvider, 'id' \| 'createdAt'>>\): boolean \{\s*const secureModeError = this\.ensureAuthenticatedUserApiMode\(\);\s*if \(secureModeError\) \{\s*throw new Error\(secureModeError\);\s*\}/);
  assert.match(source, /apiKey: '',/);
  assert.match(source, /export async function fetchGoogleModels\(apiKey: string\): Promise<string\[]> \{\s*if \(isBrowserRuntime\(\)\) \{\s*throw createBrowserDirectProviderChecksDisabledError\(\);\s*\}/);
  assert.match(source, /export async function fetchGeminiCompatModels\(apiKey: string, baseUrl\?: string\): Promise<string\[]> \{\s*if \(isBrowserRuntime\(\)\) \{\s*throw createBrowserDirectProviderChecksDisabledError\(\);\s*\}/);
  assert.match(source, /export async function fetchOpenAICompatModels\(apiKey: string, baseUrl: string\): Promise<string\[]> \{\s*if \(isBrowserRuntime\(\)\) \{\s*throw createBrowserDirectProviderChecksDisabledError\(\);\s*\}/);
  assert.match(source, /export async function autoDetectAndConfigureModels\([\s\S]*?if \(isBrowserRuntime\(\)\) \{\s*return \{\s*success: false,\s*models: \[\],\s*categories: categorizeModels\(\[\]\),\s*apiType: 'browser-direct-disabled',\s*\};\s*\}/);
});

test('LLMService uses the local user-route proxy first, falls back to cloud secure proxy, and blocks browser direct calls', () => {
  const source = readSource('src/services/llm/LLMService.ts');

  assert.match(source, /buildSecureProxyUserRouteFromSlotId/);
  assert.match(source, /callLocalUserRouteProxyChat/);
  assert.match(source, /callLocalUserRouteProxyImage/);
  assert.match(source, /callLocalUserRouteProxyVideo/);
  assert.match(source, /callLocalUserRouteProxyAudio/);
  assert.match(source, /checkLocalUserRouteProxyTaskStatus/);
  assert.match(source, /private buildUserRouteForKeySlot\(keySlot: KeySlot\): string \{/);
  assert.match(source, /private shouldUseSecureProxyUserRoute\(keySlot: KeySlot\): boolean \{/);
  assert.match(source, /return Boolean\(keyManager\.getUserId\(\)\);/);
  assert.match(source, /private shouldFallbackToCloudUserRouteAfterLocalProxy\(\s*error: unknown,\s*\): boolean \{/);
  assert.match(source, /void error;\s*return false;/);
  assert.match(source, /private createCloudFallbackNotice\(action: string, keySlot: Pick<KeySlot, 'name' \| 'provider'>\): string \{/);
  assert.match(source, /falling back to cloud/);
  assert.match(source, /private decorateTaskStatusResult\(/);
  assert.match(source, /private throwBrowserDirectProviderCallBlocked\(action: string, keySlot\?: Pick<KeySlot, 'name' \| 'provider'>\): never \{/);
  assert.match(source, /response = await callLocalUserRouteProxyChat\(\{/);
  assert.match(source, /proxyResponse = await callLocalUserRouteProxyImage\(\{/);
  assert.match(source, /response = await callLocalUserRouteProxyVideo\(\{/);
  assert.match(source, /response = await callLocalUserRouteProxyAudio\(\{/);
  assert.match(source, /userRoute: buildSecureProxyUserRouteFromSlotId\(routeId\),/);
  assert.match(source, /console\.warn\(this\.createCloudFallbackNotice\('chat routing', keySlot\), error\);/);
  assert.match(source, /console\.warn\(this\.createCloudFallbackNotice\('image routing', keySlot\), error\);/);
  assert.match(source, /console\.warn\(this\.createCloudFallbackNotice\('video routing', keySlot\), error\);/);
  assert.match(source, /console\.warn\(this\.createCloudFallbackNotice\('audio routing', keySlot\), error\);/);
  assert.match(source, /this\.throwBrowserDirectProviderCallBlocked\('chat routing', keySlot\);/);
  assert.match(source, /this\.throwBrowserDirectProviderCallBlocked\('image routing', keySlot\);/);
  assert.match(source, /this\.throwBrowserDirectProviderCallBlocked\('video routing', keySlot\);/);
  assert.match(source, /this\.throwBrowserDirectProviderCallBlocked\('audio routing', keySlot\);/);
  assert.match(source, /const shouldUseLocalUserRouteTaskStatus = taskId\.startsWith\('local_proxy:'\);/);
  assert.match(source, /const result = await checkLocalUserRouteProxyTaskStatus\(taskId\);/);
  assert.match(source, /return Promise\.all\(\s*normalizedTaskIds\.map\(\(taskId\) => this\.checkTaskStatus\(taskId, mode, preferredKeyId, modelId\)\)\s*\);/);
  assert.match(source, /this\.throwBrowserDirectProviderCallBlocked\('task status checks', preferredKeySlot \|\| undefined\);/);
  assert.match(source, /const shouldUseSecureProxyTaskStatus = \(\s*normalizedPreferredKeyId === 'system_proxy_slot'\s*\|\|\s*taskId\.startsWith\('system_proxy:'\)\s*\|\|\s*preferredKeySlot\?\.provider === 'SystemProxy'\s*\);/);
  assert.match(source, /const containsLocalProxyTasks = normalizedTaskIds\.some\(\(taskId\) => taskId\.startsWith\('local_proxy:'\)\);/);
  assert.match(source, /const containsSecureProxyTasks = normalizedTaskIds\.some\(\(taskId\) => taskId\.startsWith\('system_proxy:'\)\);/);
  assert.match(source, /const shouldUsePerTaskRouting = \(\s*normalizedPreferredKeyId === 'system_proxy_slot'\s*\|\|\s*containsLocalProxyTasks\s*\|\|\s*containsSecureProxyTasks\s*\|\|\s*preferredKeySlot\?\.provider === 'SystemProxy'\s*\);/);
  assert.doesNotMatch(source, /private hasUsableLocalDirectKey\(keySlot: KeySlot\): boolean \{/);
  assert.doesNotMatch(source, /private shouldFallbackToLocalKey\(\s*keySlot: KeySlot,\s*error: unknown,\s*\): boolean \{/);
  assert.doesNotMatch(source, /private createLocalFallbackNotice\(action: string, keySlot: Pick<KeySlot, 'name' \| 'provider'>\): string \{/);
  assert.doesNotMatch(source, /console\.warn\(this\.createLocalFallbackNotice\(/);
  assert.doesNotMatch(source, /return await this\.runDirectChat\(options, keySlot\);/);
  assert.doesNotMatch(source, /result = await this\.runDirectImage\(options, keySlot\);/);
  assert.doesNotMatch(source, /const directResult = await this\.runDirectVideo\(options, keySlot\);/);
  assert.doesNotMatch(source, /const directResult = await this\.runDirectAudio\(options, keySlot\);/);
  assert.doesNotMatch(source, /const directResult = await this\.runDirectTaskStatus\(taskId, mode, preferredKeySlot, modelId\);/);
  assert.doesNotMatch(source, /const directResults = await this\.runDirectTaskStatuses\(normalizedTaskIds, mode, preferredKeySlot, modelId\);/);
  assert.doesNotMatch(source, /return isLocalUserRouteProxyFallbackError\(error\);/);
  assert.doesNotMatch(source, /\|\| !!keyManager\.getUserId\(\)/);
  assert.match(source, /if \(options\.stream && typeof options\.onStream === 'function' && response\.content\) \{\s*options\.onStream\(response\.content\);\s*\}/);
});

test('ApiSettingsView keeps BYOK actions behind auth without hard-blocking server-side diagnostics', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /const READONLY_SECRET_PLACEHOLDER = 'sk-readonly-0000';/);
  assert.match(source, /const isReadonlySecretPlaceholder = \(value\?: string \| null\) => String\(value \|\| ''\)\.trim\(\) === READONLY_SECRET_PLACEHOLDER;/);
  assert.match(source, /import \{ useAuth \} from '\.\.\/\.\.\/context\/AuthContext';/);
  assert.match(source, /const \{ user, isTempUser \} = useAuth\(\);/);
  assert.match(source, /const authenticatedUserId = !isTempUser \? \(user\?\.id \|\| keyManager\.getUserId\(\)\) : null;/);
  assert.match(source, /const isAuthenticated = Boolean\(authenticatedUserId\);/);
  assert.match(source, /const isHydratingRuntimeUserApis = shouldUseReadonlyProfileFallback && !isUserApiPersistenceDegraded;/);
  assert.match(source, /const userApiActionsDisabled = !isAuthenticated \|\| isHydratingRuntimeUserApis;/);
  assert.match(source, /const providerActionsDisabled = !isAuthenticated \|\| isHydratingRuntimeUserApis;/);
  assert.match(source, /const userApiEditorDisabled = !isAuthenticated \|\| isHydratingRuntimeUserApis;/);
  assert.match(source, /const userApiEditorReadOnly = userApiEditorDisabled;/);
  assert.match(source, /const providerEditorReadOnly = providerActionsDisabled;/);
  assert.match(source, /const userApiEditorReadOnlyHelper = userApiEditorReadOnly/);
  assert.match(source, /const providerEditorReadOnlyHelper = providerEditorReadOnly/);
  assert.match(source, /const browserDirectChecksDisabled = false;/);
  assert.match(source, /Sign in before managing BYOK routes\. Anonymous key storage and direct provider calls are disabled in the frontend\./);
  assert.match(source, /const browserDirectChecksHelper = pick\(/);
  assert.match(source, /const ensureUserApiActionsAllowed = \(\): boolean => \{/);
  assert.match(source, /const ensureProviderActionsAllowed = \(\): boolean => \{/);
  assert.match(source, /if \(!isAuthenticated\) \{/);
  assert.match(source, /if \(isHydratingRuntimeUserApis\) \{/);
  assert.match(source, /const beginCreateOfficial = \(\) => \{\s*if \(!ensureUserApiActionsAllowed\(\)\) \{\s*return;\s*\}/);
  assert.match(source, /const beginCreateProvider = \(\) => \{\s*if \(!ensureProviderActionsAllowed\(\)\) \{\s*return;\s*\}/);
  assert.match(source, /const startEditOfficial = \(slot: KeySlot\) => \{\s*if \(!ensureUserApiActionsAllowed\(\)\) \{\s*return;\s*\}/);
  assert.match(source, /const startEditProvider = \(provider: ThirdPartyProvider\) => \{\s*if \(!ensureProviderActionsAllowed\(\)\) \{\s*return;\s*\}/);
  assert.match(source, /if \(isReadonlySecretPlaceholder\(officialForm\.key\)\) \{/);
  assert.match(source, /if \(isReadonlySecretPlaceholder\(providerForm\.apiKey\)(?:\s*&&\s*!canReusePersistedProviderSecret)?\) \{/);
  assert.match(source, /Re-enter the real API key before saving\. Read-only placeholder secrets cannot be saved back to the account\./);
  assert.match(source, /const selectedProvider = useMemo\(\(\) => \{/);
  assert.match(source, /thirdPartyProviders\.find\(\(provider\) =>/);
  assert.doesNotMatch(source, /provider\.name,\s*provider\.baseUrl/);
  assert.match(source, /const ensureBrowserDirectDiagnosticsAllowed = \(\): boolean => \{/);
  assert.doesNotMatch(source, /if \(!keyManager\.getUserId\(\)\) \{\s*return true;\s*\}/);
  assert.match(source, /'Browser direct calls disabled'/);
  assert.match(source, /if \(!ensureBrowserDirectDiagnosticsAllowed\(\)\) \{\s*return;\s*\}/);
  assert.match(source, /const headerPrimaryActionDisabled = activeTab === 'official' \? userApiActionsDisabled : providerActionsDisabled;/);
  assert.match(source, /<SettingsActionButton icon=\{Plus\} tone="primary" disabled=\{headerPrimaryActionDisabled\} onClick=\{activeTab === 'official' \? beginCreateOfficial : beginCreateProvider\}>/);
  assert.match(source, /action=\{<SettingsActionButton icon=\{Plus\} tone="primary" disabled=\{userApiActionsDisabled\} onClick=\{beginCreateOfficial\}>/);
  assert.match(source, /action=\{<SettingsActionButton icon=\{Plus\} tone="primary" disabled=\{providerActionsDisabled\} onClick=\{beginCreateProvider\}>/);
  assert.match(source, /<SettingsActionButton icon=\{Edit3\} size="sm" disabled=\{userApiActionsDisabled\} onClick=\{\(\) => startEditOfficial\(slot\)\}>/);
  assert.match(source, /<SettingsActionButton icon=\{Edit3\} size="sm" disabled=\{providerActionsDisabled\} onClick=\{\(\) => startEditProvider\(provider\)\}>/);
  assert.match(source, /<div className="rounded-\[22px\] border px-4 py-3 text-\[13px\] leading-6 text-\[var\(--state-warning-text\)\]" style=\{SETTINGS_WARNING_STYLE\}>\s*\{userApiEditorReadOnlyHelper\}\s*<\/div>/);
  assert.match(source, /<SettingInput[\s\S]*?value=\{getOfficialDisplayName\(officialForm\.provider\)\}[\s\S]*?disabled=\{userApiEditorReadOnly\}/);
  assert.match(source, /<SettingSelect[\s\S]*?value=\{officialForm\.provider\}[\s\S]*?disabled=\{userApiEditorReadOnly\}/);
  assert.match(source, /<SettingInput[\s\S]*?label="API Key"[\s\S]*?value=\{officialForm\.key\}[\s\S]*?disabled=\{userApiEditorReadOnly\}/);
  assert.match(source, /<SettingInput[\s\S]*?value=\{providerForm\.name\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
  assert.match(source, /<SettingInput[\s\S]*?value=\{providerForm\.baseUrl\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
  assert.match(source, /<SettingInput[\s\S]*?label="API Key"[\s\S]*?value=\{providerForm\.apiKey\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
  assert.match(source, /<SettingSelect[\s\S]*?value=\{providerForm\.format\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
  assert.match(source, /<SettingToggle[\s\S]*?checked=\{providerForm\.isActive\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
  assert.match(source, /<SegmentedControlMulti[\s\S]*?value=\{getModeOption\(officialForm\.mode\)\}[\s\S]*?disabled=\{userApiEditorReadOnly\}/);
  assert.match(source, /<SegmentedControlMulti[\s\S]*?value=\{getModeOption\(providerForm\.mode\)\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
});

test('AuthContext keeps KeyManager scoped to authenticated Supabase users only', () => {
  const source = readSource('src/context/AuthContext.tsx');

  assert.match(source, /import \{ keyManager \} from '\.\.\/services\/auth\/keyManager';/);
  assert.match(source, /useLayoutEffect/);
  assert.match(source, /const nextUserId = tempUserSession \? null : \(user\?\.id \|\| null\);/);
  assert.match(source, /void keyManager\.setUserId\(nextUserId\)\.catch\(\(error\) => \{/);
  assert.match(source, /emitAuthSessionChange\(\{\s*hasSession: false,\s*userId: cachedTempUser\.user\.id,\s*isTempUser: true,\s*\}\);/);
});

test('KeyManager clears prior in-memory user state before hydrating the next account scope', () => {
  const source = readSource('src/services/auth/keyManager.ts');

  assert.match(source, /async setUserId\(userId: string \| null\) \{/);
  assert.match(source, /this\.loadProviders\(true\);\s*this\.state = this\.loadState\(\);\s*this\.globalModelListCache = null;\s*this\.notifyListeners\(\);/);
  assert.match(source, /if \(this\.state\.slots\.length > 0\) \{\s*console\.log\('\[KeyManager\] Local cache loaded:', this\.state\.slots\.length, 'slots'\);/);
});

test('BillingContext clears balance and transaction state immediately when the user scope changes', () => {
  const source = readSource('src/context/BillingContext.tsx');

  assert.match(source, /const \[hydratedUserId, setHydratedUserId\] = useState<string \| null>\(null\);/);
  assert.match(source, /const activeBillingUserId = !user \|\| isTempUser \? null : user\.id;/);
  assert.match(source, /useEffect\(\(\) => \{\s*refreshPromiseRef\.current = null;/);
  assert.match(source, /window\.clearTimeout\(realtimeRefreshTimerRef\.current\);/);
  assert.match(source, /setHydratedUserId\(null\);/);
  assert.match(source, /setBalance\(0\);/);
  assert.match(source, /setBillingLogs\(\[\]\);/);
  assert.match(source, /setUsageLogs\(\[\]\);/);
  assert.match(source, /setShowRechargeModal\(false\);/);
  assert.match(source, /setHydratedUserId\(activeBillingUserId\);/);
  assert.match(source, /const hasHydratedCurrentBillingScope = Boolean\(activeBillingUserId\) && hydratedUserId === activeBillingUserId;/);
  assert.match(source, /const visibleBalance = hasHydratedCurrentBillingScope \? balance : 0;/);
  assert.match(source, /const visibleBillingLogs = hasHydratedCurrentBillingScope \? billingLogs : \[\];/);
  assert.match(source, /const visibleUsageLogs = hasHydratedCurrentBillingScope \? usageLogs : \[\];/);
  assert.match(source, /const visibleLoading = activeBillingUserId \? \(loading \|\| !hasHydratedCurrentBillingScope\) : false;/);
});

test('OpenAIVideoService fails closed instead of calling third-party providers from the browser', () => {
  const source = readSource('src/services/video/OpenAIVideoService.ts');

  assert.match(source, /const BROWSER_DIRECT_VIDEO_CALLS_DISABLED_MESSAGE =/);
  assert.match(source, /throw new Error\(BROWSER_DIRECT_VIDEO_CALLS_DISABLED_MESSAGE\);/);
  assert.doesNotMatch(source, /Authorization/);
  assert.doesNotMatch(source, /fetch\(endpoint,/);
  assert.doesNotMatch(source, /\[OpenAIVideo\] Response:/);
});
