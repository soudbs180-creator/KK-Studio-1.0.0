import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('keyManager blocks browser-side provider diagnostics and browser-side secret persistence', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');
  const storageSource = readSource('apps/web/src/services/auth/keyManagerStorage.ts');
  const providerStorageSource = readSource('apps/web/src/services/auth/keyManagerProviders.ts');
  const viteEnvSource = readSource('apps/web/src/vite-env.d.ts');
  const securityCheckSource = readSource('scripts/governance/check-sensitive-boundaries.mjs');

  assert.match(storageSource, /const LEGACY_API_KEYS_STORAGE_KEY = "kk-api-keys-local";/);
  assert.match(storageSource, /const USER_API_LOGIN_REQUIRED_MESSAGE = "Sign in before adding or updating BYOK providers\. Browser-side key storage is disabled for security\.";/);
  assert.match(storageSource, /const BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE = "Browser-side provider diagnostics are disabled\. Save the key to your account and use the server-side secure proxy path instead\.";/);
  assert.match(storageSource, /type ProviderStorageScope = "anonymous" \| "user" \| "cloud" \| "none";/);
  assert.match(storageSource, /function isBrowserRuntime\(\): boolean \{/);
  assert.match(storageSource, /function shouldAllowSessionlessLocalUserApiStorage\(\): boolean \{/);
  assert.match(storageSource, /function createBrowserDirectProviderChecksDisabledError\(\): Error \{/);
  assert.match(source, /private purgeAnonymousSensitiveLocalCaches\(\): void \{/);
  assert.match(source, /private canUseSessionlessLocalUserApiStorage\(\): boolean \{/);
  assert.match(storageSource, /localStorage\.removeItem\(LEGACY_API_KEYS_STORAGE_KEY\);/);
  assert.match(storageSource, /localStorage\.removeItem\(STORAGE_KEY\);/);
  assert.match(storageSource, /localStorage\.removeItem\(PROVIDERS_STORAGE_KEY\);/);
  assert.match(source, /purgeAnonymousSensitiveLocalCaches\(\);/);
  assert.match(source, /private ensureAuthenticatedUserApiMode\(\): string \| null \{/);
  assert.match(source, /return USER_API_LOGIN_REQUIRED_MESSAGE;/);
  assert.doesNotMatch(source, /private getBrowserDirectProviderChecksDisabledMessage\(\): string \{/);
  assert.match(source, /markPendingStateCloudSync\(this\.cloudSyncState\);\s*await this\.flushPendingCloudSync\(toSave\);/);
  assert.match(source, /async testChannel\([\s\S]*?if \(isBrowserRuntime\(\)\) \{\s*return \{\s*success: false,\s*message: BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE,\s*\};\s*\}/);
  assert.match(source, /async fetchRemoteModels\([\s\S]*?if \(isBrowserRuntime\(\)\) \{\s*console\.warn\('\[KeyManager\] Browser-side remote model discovery is disabled\.'\);\s*return \[\];\s*\}/);
  assert.match(source, /async validateKey\([\s\S]*?if \(isBrowserRuntime\(\)\) \{\s*return \{\s*valid: false,\s*error: BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE,\s*\};\s*\}/);
  assert.match(source, /async refreshKey\(id: string\): Promise<void> \{\s*if \(isBrowserRuntime\(\)\) \{\s*console\.warn\('\[KeyManager\] Browser-side key refresh is disabled\.'\);\s*return;\s*\}/);
  assert.match(source, /async revalidateAll\(\): Promise<void> \{\s*if \(isBrowserRuntime\(\)\) \{\s*console\.warn\('\[KeyManager\] Browser-side key revalidation is disabled\.'\);\s*return;\s*\}/);
  assert.match(source, /async syncProviderPricingDetailed\([\s\S]*?if \(isBrowserRuntime\(\)\) \{\s*return \{\s*ok: false,\s*message: BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE,\s*\};\s*\}/);
  assert.match(source, /async addKey\(key: string, options\?: \{[\s\S]*?const secureModeError = this\.ensureAuthenticatedUserApiMode\(\);\s*if \(secureModeError\) \{\s*return \{ success: false, error: secureModeError \};\s*\}/);
  assert.match(source, /async updateKey\(id: string, updates: Partial<KeySlot>\): Promise<void> \{\s*const secureModeError = this\.ensureAuthenticatedUserApiMode\(\);\s*if \(secureModeError\) \{\s*throw new Error\(secureModeError\);\s*\}/);
  assert.match(source, /addProvider\(config: Omit<ThirdPartyProvider, 'id' \| 'usage' \| 'status' \| 'createdAt' \| 'updatedAt'>\): ThirdPartyProvider \{\s*const secureModeError = this\.ensureAuthenticatedUserApiMode\(\);\s*if \(secureModeError\) \{\s*throw new Error\(secureModeError\);\s*\}/);
  assert.match(source, /updateProvider\(id: string, updates: Partial<Omit<ThirdPartyProvider, 'id' \| 'createdAt'>>\): boolean \{\s*const secureModeError = this\.ensureAuthenticatedUserApiMode\(\);\s*if \(secureModeError\) \{\s*throw new Error\(secureModeError\);\s*\}/);
  assert.match(source, /apiKey: getRedactedChannelConfigApiKey\(\),/);
  assert.doesNotMatch(source, /apiKey: '',/);
  assert.match(source, /export async function fetchGoogleModels\(apiKey: string\): Promise<string\[]> \{\s*if \(isBrowserRuntime\(\)\) \{\s*throw createBrowserDirectProviderChecksDisabledError\(\);\s*\}/);
  assert.match(source, /export async function fetchGeminiCompatModels\(apiKey: string, baseUrl\?: string\): Promise<string\[]> \{\s*if \(isBrowserRuntime\(\)\) \{\s*throw createBrowserDirectProviderChecksDisabledError\(\);\s*\}/);
  assert.match(source, /export async function fetchOpenAICompatModels\(apiKey: string, baseUrl: string\): Promise<string\[]> \{\s*if \(isBrowserRuntime\(\)\) \{\s*throw createBrowserDirectProviderChecksDisabledError\(\);\s*\}/);
  assert.match(source, /export async function autoDetectAndConfigureModels\([\s\S]*?if \(isBrowserRuntime\(\)\) \{\s*return \{\s*success: false,\s*models: \[\],\s*categories: categorizeModels\(\[\]\),\s*apiType: 'browser-direct-disabled',\s*\};\s*\}/);
  assert.doesNotMatch(viteEnvSource, /VITE_API_KEY/);
  assert.match(securityCheckSource, /VITE_\[A-Z0-9_\]\*\(\?:KEY\|SECRET\|TOKEN\)/);
  assert.match(securityCheckSource, /publicViteSensitiveEnvAllowlist/);
});

test('LLMService uses the local user-route proxy first, falls back to cloud secure proxy, and blocks browser direct calls', () => {
  const source = readSource('apps/web/src/services/llm/generationService.ts');

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
  assert.match(source, /return !message\.includes\('browser direct provider calls are disabled'\);/);
  assert.match(source, /private createCloudFallbackNotice\(action: string, keySlot: Pick<KeySlot, 'name' \| 'provider'>\): string \{/);
  assert.match(source, /falling back to cloud/);
  assert.match(source, /private decorateTaskStatusResult\(/);
  assert.match(source, /private throwBrowserDirectProviderCallBlocked\(action: string, keySlot\?: Pick<KeySlot, 'name' \| 'provider'>\): never \{/);
  assert.match(source, /response = await callLocalUserRouteProxyChat\(\{/);
  assert.match(source, /proxyResponse = await callLocalUserRouteProxyImage\(\{/);
  assert.match(source, /response = await callLocalUserRouteProxyVideo\(\{/);
  assert.match(source, /response = await callLocalUserRouteProxyAudio\(\{/);
  assert.match(source, /userRoute: buildSecureProxyUserRouteFromSlotId\(routeId\),/);
  assert.match(source, /console\.warn\(this\.createCloudFallbackNotice\('chat routing', keySlot\), normalizedUserRouteError\);/);
  assert.match(source, /console\.warn\(this\.createCloudFallbackNotice\('image routing', keySlot\), normalizedUserRouteError\);/);
  assert.match(source, /console\.warn\(this\.createCloudFallbackNotice\('video routing', keySlot\), normalizedUserRouteError\);/);
  assert.match(source, /console\.warn\(this\.createCloudFallbackNotice\('audio routing', keySlot\), normalizedUserRouteError\);/);
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
  const source = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const settingsUiSource = readSource('apps/web/src/components/settings/ui/index.tsx');
  const sectionSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(source, /const READONLY_SECRET_PLACEHOLDER = 'sk-readonly-0000';/);
  assert.match(source, /const isReadonlySecretPlaceholder = \(value\?: string \| null\)(?:: boolean)? => \{/);
  assert.match(source, /const resolveRuntimeSecretForSave = \(\s*draftValue: string,\s*persistedValue\?: string \| null,\s*\): string => \{/);
  assert.match(source, /function maskSecret\(secret\?: unknown\): string \{/);
  assert.match(source, /if \(isRecord\(secret\) && secret\.__kkUserApiSecret === true\) \{\s*return READONLY_SECRET_PLACEHOLDER;\s*\}/);
  assert.match(source, /clean\.startsWith\('__kk_redacted__:'\)/);
  assert.match(source, /revealUserApiSecretFromCloudRecord/);
  assert.match(source, /const savedSecretReadOnlyHelper = pick\(/);
  assert.match(source, /点击右侧眼睛会从后端临时取回明文用于核对/);
  assert.match(source, /import \{ useAuth \} from '\.\.\/\.\.\/context\/AuthContext';/);
  assert.match(source, /import \{ resolveUserApiViewState \} from '\.\.\/\.\.\/services\/api\/userApiViewState';/);
  assert.match(source, /const \{ user, isTempUser \} = useAuth\(\);/);
  assert.match(source, /const authenticatedUserId = !isTempUser \? \(user\?\.id \|\| keyManager\.getUserId\(\)\) : null;/);
  assert.match(source, /const hasAuthenticatedUser = Boolean\(authenticatedUserId\);/);
  assert.match(source, /const canUseSessionlessLocalDraftStorage = false;/);
  assert.match(source, /const canMutateSessionlessLocalWorkbench = hasSessionlessLocalWorkbench;/);
  assert.match(source, /const sessionlessLocalDraftHelper = canUseSessionlessLocalDraftStorage/);
  assert.doesNotMatch(source, /browser session until the service comes back/);
  assert.doesNotMatch(source, /当前浏览器会话/);
  assert.match(source, /const userApiViewState = resolveUserApiViewState\(\{/);
  assert.match(source, /const isHydratingRuntimeUserApis = userApiViewState\.isHydratingRuntimeUserApis;/);
  assert.match(source, /const userApiActionsDisabled = userApiViewState\.userApiActionsDisabled;/);
  assert.match(source, /const providerActionsDisabled = userApiViewState\.providerActionsDisabled;/);
  assert.match(source, /const userApiEditorDisabled = userApiViewState\.userApiEditorDisabled;/);
  assert.match(source, /const userApiEditorReadOnly = userApiEditorDisabled;/);
  assert.match(source, /const providerEditorReadOnly = userApiViewState\.providerEditorReadOnly;/);
  assert.match(source, /const userApiEditorReadOnlyHelper = userApiEditorReadOnly/);
  assert.match(source, /const providerEditorReadOnlyHelper = providerEditorReadOnly/);
  assert.match(source, /const browserDirectChecksDisabled = false;/);
  assert.match(source, /Sign in before managing BYOK routes\. Anonymous key storage and direct provider calls are disabled in the frontend\./);
  assert.match(source, /const browserDirectChecksHelper = pick\(/);
  assert.match(source, /const ensureUserApiActionsAllowed = \(\): boolean => \{/);
  assert.match(source, /const ensureProviderActionsAllowed = \(\): boolean => \{/);
  assert.match(source, /if \(hasReadonlySnapshot\) \{\s*return true;\s*\}/);
  assert.match(source, /const beginCreateOfficial = \(provider: OfficialProvider = 'Google'\) => \{\s*if \(!ensureUserApiActionsAllowed\(\)\) \{\s*return;\s*\}/);
  assert.match(source, /const beginCreateProvider = \(\) => \{\s*if \(!ensureProviderActionsAllowed\(\)\) \{\s*return;\s*\}/);
  assert.match(source, /const startEditOfficial = \(slot: KeySlot\) => \{\s*if \(!ensureUserApiActionsAllowed\(\)\) \{\s*return;\s*\}/);
  assert.match(source, /const startEditProvider = \(provider: ThirdPartyProvider\) => \{\s*if \(!ensureProviderActionsAllowed\(\)\) \{\s*return;\s*\}/);
  assert.match(source, /if \(isReadonlySecretPlaceholder\(officialForm\.key\)\) \{/);
  assert.match(source, /if \(isReadonlySecretPlaceholder\(providerForm\.apiKey\)(?:\s*&&\s*!canReusePersistedProviderSecret)?\) \{/);
  assert.match(source, /Re-enter the real API key before saving\. Read-only placeholder secrets cannot be saved back to the account\./);
  assert.match(source, /const runtimeKeyValue = resolveRuntimeSecretForSave\(officialForm\.key, existingOfficialSlot\?\.key\);/);
  assert.match(source, /key: runtimeKeyValue,/);
  assert.match(source, /const runtimeApiKeyValue = resolveRuntimeSecretForSave\(providerForm\.apiKey, existingProvider\?\.apiKey\);/);
  assert.match(source, /apiKey: runtimeApiKeyValue,/);
  assert.match(source, /const wuyinApiKeyForSave = resolveRuntimeSecretForSave\([\s\S]*?providerForm\.apiKey,[\s\S]*?shouldUseDirectUserApiRecordWrites/);
  assert.match(source, /buildCanonicalApiRecordId/);
  const presetsSource = readSource('apps/web/src/components/settings/apiProviderPresets.ts');
  assert.match(presetsSource, /WUYIN_PRESET_LOGO_URL/);
  assert.doesNotMatch(source, /`key_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 10\)\}`/);
  assert.doesNotMatch(source, /`provider_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 10\)\}`/);
  assert.match(source, /buildWuyinOneKeyProvider\(\s*wuyinApiKeyForSave,\s*catalog,\s*\{/);
  assert.match(source, /keySlotId: existingWuyinSlot\?\.id,/);
  assert.match(settingsUiSource, /if \(str === 'sk-readonly-0000'\) return '••••••••••••';/);
  assert.match(settingsUiSource, /if \(isRedactedPasswordValue\(value\)\) \{\s*return maskSecretDisplay\(value\);\s*\}\s*return value;/);
  assert.match(settingsUiSource, /await onReveal\(\);[\s\S]*setShowPassword\(true\);/);
  assert.doesNotMatch(settingsUiSource, /wuyin_••••/);
  assert.doesNotMatch(settingsUiSource, /return maskedPreview;/);
  assert.match(source, /const selectedProvider = useMemo\(\(\) => \{/);
  assert.match(source, /thirdPartyProviders\.find\(\(provider\) =>/);
  assert.doesNotMatch(source, /provider\.name,\s*provider\.baseUrl/);
  assert.match(source, /const ensureBrowserDirectDiagnosticsAllowed = \(\): boolean => \{/);
  assert.doesNotMatch(source, /if \(!keyManager\.getUserId\(\)\) \{\s*return true;\s*\}/);
  assert.match(source, /'Browser direct calls disabled'/);
  assert.match(source, /if \(!ensureBrowserDirectDiagnosticsAllowed\(\)\) \{\s*return;\s*\}/);
  assert.match(source, /resolveApiWorkbenchDiagnosticsAvailability/);
  assert.match(source, /const diagnosticsAvailability = resolveApiWorkbenchDiagnosticsAvailability\(\{\s*hasWorkbenchAccess,\s*isApiReachable: apiHealth\?\.reachable,\s*\}\);/);
  assert.match(source, /const diagnosticsRefreshDisabled = diagnosticsAvailability\.refreshDisabled;/);
  assert.match(source, /const routeDiagnosticsActionDisabled = diagnosticsAvailability\.routeActionsDisabled;/);
  assert.doesNotMatch(source, /const diagnosticsActionDisabled = !isAuthenticated \|\| apiHealth\?\.reachable === false;/);
  assert.doesNotMatch(source, /const headerPrimaryActionDisabled = activeTab === 'official' \? userApiActionsDisabled : providerActionsDisabled;/);
  assert.match(sectionSource, /data-testid="api-official-provider-add"/);
  assert.match(source, /onClick=\{handleCreateOfficialAction\}/);
  assert.doesNotMatch(source, /data-testid="api-official-empty-create"/);
  assert.match(source, /onAddProvider=\{beginCreateProvider\}/);
  assert.match(source, /onSelect: \(\) => startEditOfficial\(slot\)/);
  assert.match(source, /onSelect: \(\) => startEditProvider\(provider\)/);
  assert.match(source, /<div className="rounded-\[22px\] border px-4 py-3 text-\[1[34]px\] leading-6 text-\[var\(--state-warning-text\)\]" style=\{SETTINGS_WARNING_STYLE\}>\s*\{userApiEditorReadOnlyHelper\}\s*<\/div>/);
  assert.match(source, /<SettingInput[\s\S]*?value=\{getOfficialDisplayName\(officialForm\.provider\)\}[\s\S]*?disabled=\{userApiEditorReadOnly\}/);
  assert.match(source, /<SettingSelect[\s\S]*?value=\{officialForm\.provider\}[\s\S]*?disabled=\{userApiEditorReadOnly\}/);
  assert.match(source, /<SettingInput[\s\S]*?label="API Key"[\s\S]*?value=\{officialForm\.key\}[\s\S]*?onReveal=\{isReadonlySecretPlaceholder\(officialForm\.key\) \? revealOfficialSecret : undefined\}[\s\S]*?disabled=\{userApiEditorReadOnly\}/);
  // [FIX] providerForm.name is removed in simplify config refactor
  // assert.match(source, /<SettingInput[\s\S]*?value=\{providerForm\.name\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
  assert.match(source, /<SettingInput[\s\S]*?value=\{providerForm\.baseUrl\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
  assert.match(source, /<SettingInput[\s\S]*?label="API Key"[\s\S]*?value=\{providerForm\.apiKey\}[\s\S]*?onReveal=\{isReadonlySecretPlaceholder\(providerForm\.apiKey\) \? revealProviderSecret : undefined\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
  assert.match(source, /<SettingSelect[\s\S]*?value=\{providerForm\.format\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
  assert.match(source, /<SettingToggle[\s\S]*?checked=\{providerForm\.isActive\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
  assert.match(source, /<SegmentedControlMulti[\s\S]*?value=\{getModeOption\(officialForm\.mode\)\}[\s\S]*?disabled=\{userApiEditorReadOnly\}/);
  assert.match(source, /<SegmentedControlMulti[\s\S]*?value=\{getModeOption\(providerForm\.mode\)\}[\s\S]*?disabled=\{providerEditorReadOnly\}/);
});

test('request-boundary helpers block placeholder secrets before provider transport', () => {
  const apiConfigSource = readSource('apps/web/src/services/api/apiConfig.ts');
  const secureProxySource = readSource('apps/web/src/services/model/secureModelProxy.ts');
  const videoServiceSource = readSource('apps/web/src/services/video/videoService.ts');
  const veoVideoServiceSource = readSource('apps/web/src/services/video/VeoVideoService.ts');

  assert.match(apiConfigSource, /export function normalizeApiKeyForTransport\(value: unknown\): string \{/);
  assert.match(apiConfigSource, /token === 'sk-readonly-0000'/);
  assert.match(apiConfigSource, /token\.startsWith\('__kk_redacted__:'\)/);
  assert.match(apiConfigSource, /token === '\[object Object\]'/);
  assert.match(apiConfigSource, /token\.includes\('\.\.\.'\)/);
  assert.match(apiConfigSource, /isEncryptedSecretJsonString\(token\)/);
  assert.match(apiConfigSource, /if \(!token\) \{\s*return '';\s*\}/);
  assert.match(apiConfigSource, /return token \? `\$\{endpoint\}\?key=\$\{encodeURIComponent\(token\)\}` : endpoint;/);
  assert.match(apiConfigSource, /headers\[headerName\] = headerName === 'Authorization'[\s\S]*: token;/);

  assert.match(secureProxySource, /function normalizeUserApiSecretForTransport\(value: unknown\): string \{/);
  assert.match(secureProxySource, /targetApiKey = normalizeUserApiSecretForTransport\(rawTargetApiKey\);/);
  assert.match(secureProxySource, /if \(rawTargetApiKey && !targetApiKey\) \{/);
  assert.match(secureProxySource, /LOCAL_USER_ROUTE_SECRET_REQUIRED_CODE/);
  assert.match(secureProxySource, /proxyHeaders\['X-Proxy-Api-Key'\] = targetApiKey;/);

  assert.match(videoServiceSource, /import \{ getApiKeyToken \} from '\.\.\/api\/apiConfig';/);
  assert.match(videoServiceSource, /const apiKeyToken = getApiKeyToken\(apiKey\);/);
  assert.match(videoServiceSource, /apiKey = getApiKeyToken\(apiKey\);/);
  assert.match(videoServiceSource, /Re-enter or reveal the real API key before retrying\./);

  assert.match(veoVideoServiceSource, /import \{ getApiKeyToken \} from '\.\.\/api\/apiConfig';/);
  assert.match(veoVideoServiceSource, /apiKey = getApiKeyToken\(apiKey\);/);
  assert.match(veoVideoServiceSource, /Re-enter or reveal the real API key before retrying\./);
});

test('AuthContext keeps KeyManager scoped to the current KK runtime user and clears auth state on invalidation', () => {
  const source = readSource('apps/web/src/context/AuthContext.tsx');

  assert.match(source, /import \{ keyManager \} from ["']\.\.\/services\/auth\/keyManager["'];/);
  assert.match(source, /useLayoutEffect/);
  assert.match(source, /const runtimeUserId = runtimeState\.user\?\.id \|\| null;/);
  assert.match(source, /const allowSessionlessLocalUserApiStorage =/);
  assert.match(source, /const keyManagerUserId = allowSessionlessLocalUserApiStorage/);
  assert.match(source, /void keyManager\.setUserId\(keyManagerUserId, \{\s*sessionlessLocalUserApiStorageEnabled: allowSessionlessLocalUserApiStorage,\s*\}\)\.catch\(\(error\) => \{/);
  assert.match(source, /emitAuthSessionChange\(\{\s*hasSession: Boolean\(sessionAccessToken\) && !runtimeState\.isTempUser,/);
  assert.match(source, /subscribeAuthSessionInvalidationRequest\(\(\) => \{/);
  assert.match(source, /setRuntimeState\(clearPersistedRuntimeAuthState\(\)\);/);
});

test('KeyManager clears prior in-memory user state before hydrating the next account scope', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');

  assert.match(source, /async setUserId\(\s*userId: string \| null,\s*options\?: \{\s*sessionlessLocalUserApiStorageEnabled\?: boolean;\s*\},\s*\) \{/);
  assert.match(source, /this\.loadProviders\(true\);\s*this\.state = this\.loadState\(\);\s*this\.globalModelListCache = null;\s*this\.notifyListeners\(\);/);
  assert.match(source, /if \(this\.state\.slots\.length > 0\) \{\s*console\.log\('\[KeyManager\] Local cache loaded:', this\.state\.slots\.length, 'slots'\);/);
  assert.match(source, /this\.sessionlessLocalUserApiStorageEnabled =/);
  assert.match(source, /console\.log\('\[KeyManager\] Local API temp user payload bridge enabled:', userId\);/);
  assert.doesNotMatch(source, /Local-only temp user storage enabled/);
});

test('BillingContext clears balance and transaction state immediately when the user scope changes', () => {
  const source = readSource('apps/web/src/context/BillingContext.tsx');

  assert.match(source, /const \[refreshing, setRefreshing\] = useState\(false\);/);
  assert.match(source, /const \[hydratedUserId, setHydratedUserId\] = useState<string \| null>\(null\);/);
  assert.match(source, /const activeBillingUserId = billingRuntime\.activeBillingUserId;/);
  assert.match(source, /const hasVisibleBillingSeed = Boolean\(activeBillingUserId\) && hydratedUserId === activeBillingUserId;/);
  assert.match(source, /useEffect\(\(\) => \{\s*refreshPromiseRef\.current = null;/);
  assert.match(source, /window\.clearTimeout\(realtimeRefreshTimerRef\.current\);/);
  assert.match(source, /setHydratedUserId\(null\);/);
  assert.match(source, /setBalance\(0\);/);
  assert.match(source, /setBillingLogs\(\[\]\);/);
  assert.match(source, /setUsageLogs\(\[\]\);/);
  assert.match(source, /setShowRechargeModal\(false\);/);
  assert.match(source, /setHydratedUserId\(activeBillingUserId\);/);
  assert.match(source, /const hasHydratedCurrentBillingScope = Boolean\(activeBillingUserId\) && hydratedUserId === activeBillingUserId;/);
  assert.match(source, /const canStartBillingBootstrap = isStageReady\('background_ready'\);/);
  assert.match(source, /const hasVisibleBillingSeed = Boolean\(activeBillingUserId\) && hydratedUserId === activeBillingUserId;/);
  assert.match(source, /const refreshMode = resolveBillingRefreshMode\(\{\s*silent: options\?\.silent === true,\s*hasVisibleBillingSeed,\s*\}\);/);
  assert.match(source, /const renderCachedSnapshot = !hasHydratedCurrentBillingScope && activeBillingUserId/);
  assert.match(source, /const visibleBalance = hasHydratedCurrentBillingScope\s*\?\s*balance\s*:\s*\(renderCachedSnapshot\?\.balance \?\? 0\);/);
  assert.match(source, /const visibleBillingLogs = hasHydratedCurrentBillingScope\s*\?\s*billingLogs\s*:\s*\(renderCachedSnapshot\?\.billingLogs \?\? \[\]\);/);
  assert.match(source, /const visibleUsageLogs = hasHydratedCurrentBillingScope\s*\?\s*usageLogs\s*:\s*\(renderCachedSnapshot\?\.usageLogs \?\? \[\]\);/);
  assert.match(source, /const visibleLoading = activeBillingUserId[\s\S]*\?\s*\(\(!hasHydratedCurrentBillingScope && !renderCachedSnapshot\) \|\| loading \|\| !canStartBillingBootstrap\)[\s\S]*:\s*false;/);
  assert.match(source, /refreshing,/);
});

test('OpenAIVideoService fails closed instead of calling third-party providers from the browser', () => {
  const source = readSource('apps/web/src/services/video/OpenAIVideoService.ts');

  assert.match(source, /const BROWSER_DIRECT_VIDEO_CALLS_DISABLED_MESSAGE =/);
  assert.match(source, /throw new Error\(BROWSER_DIRECT_VIDEO_CALLS_DISABLED_MESSAGE\);/);
  assert.doesNotMatch(source, /Authorization/);
  assert.doesNotMatch(source, /fetch\(endpoint,/);
  assert.doesNotMatch(source, /\[OpenAIVideo\] Response:/);
});
