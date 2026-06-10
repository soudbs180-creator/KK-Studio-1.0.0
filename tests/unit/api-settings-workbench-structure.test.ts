import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('ApiSettingsView list mode exposes a dedicated workspace snapshot section', () => {
  const source = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(source, /API Operations Overview/);
});

test('ApiSettingsView default mode exposes a Model Center provider pool with a preset directory', () => {
  const viewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const sectionsSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(viewSource, /<ApiWorkbenchModelCenterSection/);
  assert.match(viewSource, /routes=\{modelCenterRoutes\}/);
  assert.match(viewSource, /presets=\{modelCenterPresets\}/);
  assert.match(viewSource, /By default, routing prefers the available channel with the highest budget or token limit/);
  assert.match(viewSource, /navigate\(buildProviderEditorPath\(null\)\)/);
  assert.match(viewSource, /Provider prefilled/);
  assert.doesNotMatch(viewSource, /saveProvider\(\)[\s\S]{0,180}Provider prefilled/);
  assert.match(viewSource, /toProviderFormFromPreset,\s*[\s\S]*from '\.\/apiProviderPresets';/);
  assert.match(viewSource, /const toProviderFormFromSupplier = \(supplier: Supplier\): ProviderForm => \(\{[\s\S]*apiKey: '',[\s\S]*apiKeyPreview: '',/);
  assert.match(viewSource, /const nextDraft = toProviderFormFromPreset\(preset\);[\s\S]*setEditingProviderId\(null\);[\s\S]*navigate\(buildProviderEditorPath\(null\),/);
  assert.doesNotMatch(viewSource, /const existingProvider = thirdPartyProviders\.find\([\s\S]{0,160}p\.name === preset\.name/);
  assert.doesNotMatch(viewSource, /Provider loaded/);

  assert.match(sectionsSource, /testId="settings-model-center"/);
  assert.doesNotMatch(sectionsSource, /data-testid="api-connection-wizard-open"/);
  assert.doesNotMatch(sectionsSource, /Connect AI service/);
  assert.match(sectionsSource, /data-testid="api-official-provider-add"/);
  assert.match(sectionsSource, /data-testid="api-proxy-provider-add"/);
  assert.match(sectionsSource, /presetTab === 'official'/);
  assert.match(sectionsSource, /presetTab === 'relay'/);
  assert.match(sectionsSource, /settings-model-center-preset-row/);
  assert.doesNotMatch(sectionsSource, /settings-model-center-preset__external[\s\S]{0,120}role="button"/);
  assert.match(sectionsSource, /data-testid="api-model-center-provider-pool"/);
  assert.match(sectionsSource, /data-testid="api-model-center-preset-directory"/);
  assert.match(sectionsSource, /Preset directory/);
  assert.match(sectionsSource, /Clicking only prefills the editor\. You still need to enter an API key and save\./);

  assert.match(cssSource, /\.settings-panel \.settings-model-center-layout \{[\s\S]*grid-template-columns: minmax\(0, (?:842px|1\.8fr)\) minmax\(270px, 1fr\);/);
  assert.match(cssSource, /\.settings-panel \.settings-model-center-route-grid \{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(270px, 1fr\)\);/);
  assert.match(cssSource, /\.settings-panel \.settings-model-center-route__metric-value \{[\s\S]*font-variant-numeric: tabular-nums;/);
});

test('ApiSettingsView keeps provider setup flat without the removed connection wizard layer', () => {
  const viewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.doesNotMatch(viewSource, /ApiConnectionWizard/);
  assert.doesNotMatch(viewSource, /showConnectionWizard/);
  assert.doesNotMatch(viewSource, /renderConnectionWizard/);
  assert.doesNotMatch(viewSource, /createProviderFromConnectionWizard/);
  assert.match(viewSource, /modelCenterPresetTab/);
  assert.match(viewSource, /kind: preset\.kind === 'relay' \? 'relay' as const : 'official' as const/);

  assert.doesNotMatch(cssSource, /settings-connection-wizard/);
  assert.match(cssSource, /\.settings-panel \.settings-model-center-directory__tabs/);
});

test('Admin API config uses the same official and relay card model while exposing credit parameters', () => {
  const source = readSource('apps/web/src/pages/admin/ApiConfigPanel.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(source, /ADMIN_API_PRESETS/);
  assert.match(source, /kind: "official"/);
  assert.match(source, /kind: "relay"/);
  assert.match(source, /ADMIN_MODEL_QUALITY_KEYS\.map/);
  assert.match(source, /saveAdminCreditProvider/);
  assert.match(source, /retainApiKeyFingerprints/);
  assert.match(source, /const qualityPricing = isTarget \? nextPricing/);
  assert.match(source, /createDraftFromPreset/);
  assert.match(source, /handleSaveDraftProvider/);
  assert.match(source, /data-testid="admin-api-provider-draft"/);
  assert.doesNotMatch(source, /admin-pricing-draft/);
  assert.match(source, /API 供应商配置/);
  assert.match(cssSource, /\.admin-api-nexus \{/);
  assert.match(cssSource, /\.admin-api-nexus__pricing-grid \{/);
  assert.match(cssSource, /\.admin-api-nexus__draft \{/);
});

test('ApiSettingsView keeps the default list-mode hero framed as model center while advanced workbench sections remain available', () => {
  const source = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /Model center/);
  assert.match(source, /if \(!showAdvancedWorkbench\) return null;/);
  assert.match(source, /\{renderAdvancedPanels\(\)\}/);
  assert.doesNotMatch(source, /API workspace/);
});

test('ApiSettingsView keeps platform capabilities as a dedicated section instead of mixing them into provider list content', () => {
  const source = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(source, /Platform entry/);
});

test('ApiSettingsView delegates workbench stages, shared sections, and shared cards to focused modules', () => {
  const viewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const stageSource = readSource('apps/web/src/components/settings/apiWorkbenchState.ts');
  const sectionsSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
  const cardsSource = readSource('apps/web/src/components/settings/apiWorkbenchCards.tsx');
  const scaffoldSource = readSource('apps/web/src/components/settings/SettingsScaffold.tsx');

  assert.match(viewSource, /from '\.\/apiWorkbenchState';/);
  assert.match(viewSource, /from '\.\/apiWorkbenchSections';/);
  assert.match(scaffoldSource, /surface\?: 'card' \| 'plain';/);

  assert.match(stageSource, /export type ApiSettingsWorkbenchStage = UserApiWorkbenchStage;/);
  assert.match(stageSource, /export function resolveApiWorkbenchDiagnosticsAvailability/);
  assert.match(stageSource, /export function resolveApiWorkbenchStageMeta/);
  assert.doesNotMatch(stageSource, /input\.showDiagnostics \? 'diagnostics' : input\.stage/);

  assert.match(viewSource, /<ApiWorkbenchOverviewSection/);
  assert.match(viewSource, /<ApiWorkbenchCurrentViewSection/);
  assert.match(viewSource, /<ApiWorkbenchStageSection/);
  assert.match(viewSource, /<ApiWorkbenchPlatformSection/);
  assert.match(viewSource, /<ApiWorkbenchModelCenterSection/);
  assert.match(sectionsSource, /Current view/);
  assert.match(sectionsSource, /Status and next step/);
  assert.match(sectionsSource, /Diagnostics view/);
  assert.match(sectionsSource, /surface="plain"/);
  assert.match(sectionsSource, /testId="settings-workbench-diagnostics"[\s\S]*surface="plain"/);
  assert.match(sectionsSource, /className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"/);
  assert.match(sectionsSource, /className="min-w-0 flex-1 space-y-2 text-left"/);
  assert.doesNotMatch(sectionsSource, /label=\{pick\('[^']*', 'Stage'\)/);
  assert.doesNotMatch(sectionsSource, /testId="settings-workbench-current-view"[\s\S]*rounded-\[24px\] border p-4/);
  assert.match(cardsSource, /export const ConsoleEndpointCard/);

  assert.doesNotMatch(viewSource, /const InfoCell:/);
  assert.doesNotMatch(viewSource, /const PlatformAssistantEntryCard:/);
  assert.doesNotMatch(viewSource, /const ConsoleEndpointCard:/);
  assert.doesNotMatch(viewSource, /const userApiWorkbenchStage = showDiagnostics \? 'diagnostics' : userApiViewState\.stage;/);
});

test('ApiSettingsView surfaces a model-center API list and keeps provider creation scoped', () => {
  const viewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const sectionsSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(viewSource, /<ApiWorkbenchModelCenterSection/);
  assert.match(sectionsSource, /data-testid="api-simple-provider-add"/);
  assert.match(sectionsSource, /data-testid="api-proxy-provider-add"/);
  assert.match(sectionsSource, /pick\('官方', 'Official'\)/);
  assert.match(sectionsSource, /pick\('中转站', 'Relay'\)/);
  assert.match(viewSource, /thirdPartyProviders\.map\(\(provider\)/);

  assert.match(viewSource, /beginCreateOfficial/);
  assert.match(viewSource, /buildOfficialEditorPath/);
  assert.match(sectionsSource, /value: 'official', label: pick\('[^']*', 'Local APIs'\)/);

  const directOfficialButtonUsages = viewSource.match(/onClick=\{\(\) => beginCreateOfficial\(\)\}/g) ?? [];
  const createProxyAddEntryUsages = sectionsSource.match(/data-testid="api-proxy-provider-add"/g) ?? [];
  const createProviderButtonUsages = viewSource.match(/onAddProvider=\{beginCreateProvider\}/g) ?? [];

  assert.equal(directOfficialButtonUsages.length, 0, 'Expected official creation to go through shared handlers instead of inline anonymous calls.');
  assert.equal(createProxyAddEntryUsages.length, 1, 'Expected model center to expose one proxy provider add entry.');
  assert.ok(createProviderButtonUsages.length >= 1, 'Expected provider creation to be available from the model center add entry.');
});

test('ApiSettingsView keeps diagnostics and section actions owned by shared modules instead of hidden duplicate controls', () => {
  const viewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');

  assert.doesNotMatch(viewSource, /data-testid="api-workbench-diagnostics-toggle"/);
  assert.doesNotMatch(viewSource, /className="hidden"[^\n]*beginCreateOfficial/);
  assert.doesNotMatch(viewSource, /className="hidden"[^\n]*beginCreateProvider/);
});

test('ApiSettingsView delegates readonly snapshot persistence to a focused module', () => {
  const viewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const snapshotSource = readSource('apps/web/src/components/settings/apiUserApiViewSnapshot.ts');

  assert.match(viewSource, /from '\.\/apiUserApiViewSnapshot';/);
  assert.doesNotMatch(viewSource, /USER_API_VIEW_SNAPSHOT_PREFIX/);
  assert.doesNotMatch(viewSource, /function readUserApiViewSnapshot/);
  assert.doesNotMatch(viewSource, /function writeUserApiViewSnapshot/);
  assert.doesNotMatch(viewSource, /function clearUserApiViewSnapshot/);

  assert.match(snapshotSource, /export interface UserApiViewSnapshot/);
  assert.match(snapshotSource, /export function readUserApiViewSnapshot/);
  assert.match(snapshotSource, /export function writeUserApiViewSnapshot/);
  assert.match(snapshotSource, /export function clearUserApiViewSnapshot/);
});

test('ApiSettingsView delegates provider presets to a focused module', () => {
  const viewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');

  assert.match(
    viewSource,
    /import \{[\s\S]*PROVIDER_PRESETS,[\s\S]*findProviderPresetForDraft,[\s\S]*getProviderPresetLinks,[\s\S]*toProviderFormFromPreset,[\s\S]*\} from '\.\/apiProviderPresets';/,
  );
  assert.doesNotMatch(viewSource, /interface ProviderPreset/);
  assert.doesNotMatch(viewSource, /const PROVIDER_PRESETS/);
});

test('ApiSettingsView delegates pure formatting helpers to a focused module', () => {
  const viewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const formatterSource = readSource('apps/web/src/components/settings/apiSettingsFormatters.ts');
  const formatterImport = viewSource.match(/import \{([\s\S]*?)\} from '\.\/apiSettingsFormatters';/);
  const formatterHelpers = [
    'formatUsd',
    'formatTokens',
    'formatDateTime',
    'formatLatency',
    'extractDomain',
    'maskSecretDisplay',
    'getModeLabel',
    'getModeOption',
    'parseModeOption',
    'getProtocolLabel',
    'getOfficialProviderLabel',
  ];

  assert.ok(formatterImport, 'Expected ApiSettingsView.tsx to import formatters from ./apiSettingsFormatters.');
  for (const helperName of formatterHelpers) {
    assert.match(formatterImport[1], new RegExp(`\\b${helperName}\\b`));
    assert.match(formatterSource, new RegExp(`export const ${helperName}\\b`));
    assert.doesNotMatch(viewSource, new RegExp(`const\\s+${helperName}\\s*=`));
    assert.doesNotMatch(viewSource, new RegExp(`function\\s+${helperName}\\b`));
  }

  assert.doesNotMatch(formatterSource, /^import\b/m);
  assert.match(formatterSource, /export type ApiProtocolFormat = 'auto' \| 'openai' \| 'gemini' \| 'claude';/);
  assert.match(formatterSource, /export type CostMode = 'unlimited' \| 'amount' \| 'tokens';/);
  assert.match(formatterSource, /export type OfficialProvider = 'Google' \| 'OpenAI';/);
  assert.match(formatterSource, /export const UI_BUDGET_OPTIONS = \['不限额', '金额预算', UI_TOKEN_LIMIT_LABEL\] as const;/);
  assert.doesNotMatch(formatterSource, /from 'react';/);
  assert.doesNotMatch(formatterSource, /from '\.\/ui/);
  assert.doesNotMatch(formatterSource, /from '\.\/SettingsScaffold/);
  assert.doesNotMatch(formatterSource, /from '\.\.\/\.\.\/services\//);
  assert.doesNotMatch(formatterSource, /from '\.\.\/\.\.\/context\//);
});
