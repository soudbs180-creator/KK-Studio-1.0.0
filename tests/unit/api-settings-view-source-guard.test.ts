import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const ROOT_DIR = process.cwd();
const API_SETTINGS_VIEW_PATH = 'src/components/settings/ApiSettingsView.tsx';

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ApiSettingsView stays parseable and keeps core Chinese labels free of mojibake regressions', () => {
  const source = readSource(API_SETTINGS_VIEW_PATH);
  const sourceFile = ts.createSourceFile(
    API_SETTINGS_VIEW_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const parseDiagnostics = sourceFile.parseDiagnostics.map((diagnostic) => ({
    line: diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line ?? 0,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }));

  assert.deepEqual(
    parseDiagnostics,
    [],
    `Expected ApiSettingsView.tsx to parse without diagnostics, got:\n${JSON.stringify(parseDiagnostics, null, 2)}`,
  );

  const requiredSnippets = [
    "const TOKEN_UNIT_LABEL = '词元';",
    "const TOKEN_LIMIT_LABEL = '词元上限';",
    "const LEGACY_TOKEN_LIMIT_LABEL = '令牌上限';",
    "const BUDGET_OPTIONS = ['不限额', '金额预算', TOKEN_LIMIT_LABEL] as const;",
    "if (!value.trim()) return '尚未填写';",
    "if (value.length <= 10) return '已填写';",
    "return `${value.slice(0, 6)}••••${value.slice(-4)}`;",
  ];

  for (const snippet of requiredSnippets) {
    assert.ok(source.includes(snippet), `Expected ApiSettingsView.tsx to include: ${snippet}`);
  }
});

test('ApiSettingsView keeps its secure proxy client import and inline-create aliases wired up', () => {
  const source = readSource(API_SETTINGS_VIEW_PATH);

  assert.match(
    source,
    /import \{ kkWebApiClient \} from '\.\.\/\.\.\/services\/api\/kkApiClient';/,
  );
  assert.match(source, /const showInlineOfficialCreate = activeEditorMode === null && activeTab === 'official';/);
  assert.match(source, /const showInlineProviderCreate = activeEditorMode === null && activeTab === 'third-party';/);
});
