import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const ROOT_DIR = process.cwd();
const API_SETTINGS_VIEW_PATH = 'apps/web/src/components/settings/ApiSettingsView.tsx';



test('ApiSettingsView stays parseable and keeps core Chinese labels free of mojibake regressions', () => {
  const source = readSource(API_SETTINGS_VIEW_PATH);
  const formatterSource = readSource('apps/web/src/components/settings/apiSettingsFormatters.ts');
  const sourceFile = ts.createSourceFile(
    API_SETTINGS_VIEW_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const parseDiagnostics = (sourceFile as any).parseDiagnostics.map((diagnostic: any) => ({
    line: diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line ?? 0,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }));

  assert.deepEqual(
    parseDiagnostics,
    [],
    `Expected ApiSettingsView.tsx to parse without diagnostics, got:\n${JSON.stringify(parseDiagnostics, null, 2)}`,
  );

  const formatterSourceFile = ts.createSourceFile(
    'apps/web/src/components/settings/apiSettingsFormatters.ts',
    formatterSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const formatterParseDiagnostics = (formatterSourceFile as any).parseDiagnostics.map((diagnostic: any) => ({
    line: diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line ?? 0,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }));

  assert.deepEqual(
    formatterParseDiagnostics,
    [],
    `Expected apiSettingsFormatters.ts to parse without diagnostics, got:\n${JSON.stringify(formatterParseDiagnostics, null, 2)}`,
  );

  const formatterRequiredSnippets = [
    "export const UI_TOKEN_UNIT_LABEL = '词元';",
    "export const UI_TOKEN_LIMIT_LABEL = '词元上限';",
    "export const UI_LEGACY_TOKEN_LIMIT_LABEL = '令牌上限';",
    "export const UI_BUDGET_OPTIONS = ['不限额', '金额预算', UI_TOKEN_LIMIT_LABEL] as const;",
    "if (!value.trim()) return '尚未填写';",
    "if (value.length <= 10) return '已填写';",
    "return `${value.slice(0, 6)}••••${value.slice(-4)}`;",
  ];
  const viewRequiredSnippets = [
    "pick('当前操作暂时无法完成。', 'The current action could not be completed right now.')",
    "pick('操作失败', 'Action failed')",
  ];

  for (const snippet of formatterRequiredSnippets) {
    assert.ok(formatterSource.includes(snippet), `Expected apiSettingsFormatters.ts to include: ${snippet}`);
  }
  for (const snippet of viewRequiredSnippets) {
    assert.ok(source.includes(snippet), `Expected ApiSettingsView.tsx to include: ${snippet}`);
  }

  assert.ok(!formatterSource.includes("const UI_BUDGET_OPTIONS = ['Unlimited', 'Budget', UI_TOKEN_LIMIT_LABEL] as const;"));
  assert.ok(!source.includes("const BUDGET_OPTIONS = ['不限额', '金额预算', TOKEN_LIMIT_LABEL] as const;"));
  assert.ok(!source.includes("pick('\u8930\u64b3\u58a0\u93bf\u5d84\u7d94\u93c6\u509b\u6902\u93c3\u72b3\u7876\u7039\u5c7e\u579a\u9286?'"));
  assert.ok(!source.includes("pick('\u93bf\u5d84\u7d94\u6fb6\u8fab\u89e6'"));
});

test('ApiSettingsView keeps its secure proxy client import and route-driven editor visibility wiring intact', () => {
  const source = readSource(API_SETTINGS_VIEW_PATH);

  assert.match(
    source,
    /import \{ kkWebApiClient(?:, shouldUseLegacyWebApiFallback)? \} from '\.\.\/\.\.\/services\/api\/kkApiClient';/,
  );
  assert.match(source, /const activeEditorMode: TabType \| null = isOfficialEditorRoute \? 'official' : isProviderEditorRoute \? 'third-party' : null;/);
  assert.match(source, /const showOfficialEditor = activeEditorMode === 'official';/);
  assert.match(source, /const showProviderEditor = activeEditorMode === 'third-party';/);
  assert.doesNotMatch(source, /const showInlineOfficialCreate =/);
  assert.doesNotMatch(source, /const showInlineProviderCreate =/);
});

test('ApiSettingsView persists readonly user API snapshots in localStorage for cross-session recovery', () => {
  const source = readSource(API_SETTINGS_VIEW_PATH);
  const snapshotSource = readSource('apps/web/src/components/settings/apiUserApiViewSnapshot.ts');

  assert.match(source, /from '\.\/apiUserApiViewSnapshot';/);
  assert.match(snapshotSource, /window\.localStorage\.getItem\(getUserApiViewSnapshotKey\(normalizedUserId\)\)/);
  assert.match(snapshotSource, /window\.localStorage\.setItem\(getUserApiViewSnapshotKey\(normalizedUserId\), JSON\.stringify\(\{/);
  assert.match(snapshotSource, /window\.localStorage\.removeItem\(getUserApiViewSnapshotKey\(normalizedUserId\)\)/);
});

test('ApiSettingsView resolves effective provider models before readonly rendering and cloud-backed saves', () => {
  const source = readSource(API_SETTINGS_VIEW_PATH);
  const snapshotSource = readSource('apps/web/src/components/settings/apiUserApiViewSnapshot.ts');

  assert.match(snapshotSource, /const providerName = normalizeString\(raw\.name\) \|\| 'Provider';/);
  assert.match(snapshotSource, /const providerBaseUrl = normalizeString\(raw\.baseUrl \?\? raw\.base_url\);/);
  assert.match(snapshotSource, /const providerFormat = normalizeProtocolFormat\(raw\.format\);/);
  assert.match(snapshotSource, /const rawProviderModels = normalizeStringArray\(raw\.models \?\? raw\.supportedModels \?\? raw\.supported_models\);/);
  assert.match(
    snapshotSource,
    /models:\s*resolveEffectiveProviderModels\(\{\s*provider:\s*providerName,\s*baseUrl:\s*providerBaseUrl,\s*format:\s*providerFormat,\s*models:\s*rawProviderModels,\s*\}\)/,
  );
  assert.match(
    source,
    /const effectiveProviderModelsForCloudWrite = resolveEffectiveProviderModels\(\{[\s\S]*provider:\s*providerForm\.name\.trim\(\),[\s\S]*baseUrl:\s*providerForm\.baseUrl\.trim\(\),[\s\S]*format:\s*providerForm\.format,[\s\S]*models:\s*connectionSignatureChanged \? \[\] : \(existingProvider\?\.models \|\| \[\]\),[\s\S]*\}\);/,
  );
  assert.match(source, /models:\s*effectiveProviderModelsForCloudWrite,/);
});
