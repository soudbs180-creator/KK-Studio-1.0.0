import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();
const API_SETTINGS_VIEW_PATH = 'src/components/settings/ApiSettingsView.tsx';



test('ApiSettingsView keeps editor save buttons behind inline validation feedback', () => {
  const source = readSource(API_SETTINGS_VIEW_PATH);

  assert.match(source, /const officialEditorValidationMessage = \(\(\) => \{/);
  assert.match(source, /return pick\('先填写 API Key 才能保存。', 'Enter the API key before saving\.'\);/);
  assert.match(source, /return pick\('请重新输入真实 API Key。', 'Re-enter the real API key before saving\.'\);/);
  assert.match(source, /<PrimaryButton disabled=\{userApiActionsDisabled \|\| Boolean\(officialEditorValidationMessage\)\}/);
  assert.match(source, /const resetOfficialDraft = \(\) => \{[\s\S]*setOfficialForm\(buildOfficialDraft\(officialForm\.provider\)\);[\s\S]*\};/);
  assert.match(source, /<SecondaryButton onClick=\{editingOfficialId \? cancelEdit : resetOfficialDraft\}>/);
  assert.match(
    source,
    /\{officialEditorValidationMessage \? \(\s*<div className="text-\[1[34]px\] leading-6 text-\[var\(--state-warning-text\)\]">\s*\{officialEditorValidationMessage\}/s,
  );

  assert.match(source, /const providerEditorValidationMessage = \(\(\) => \{/);
  assert.match(
    source,
    /return pick\('补全名称、Base URL 和 API Key 后才能保存。', 'Complete the name, base URL, and API key before saving\.'\);/,
  );
  assert.match(source, /<PrimaryButton disabled=\{providerActionsDisabled \|\| Boolean\(providerEditorValidationMessage\)\}/);
  assert.match(source, /const resetProviderDraft = \(\) => \{[\s\S]*setProviderForm\(providerDefaults\);[\s\S]*\};/);
  assert.match(source, /<SecondaryButton onClick=\{editingProviderId \? cancelEdit : resetProviderDraft\}>/);
  assert.match(
    source,
    /\{providerEditorValidationMessage \? \(\s*<div className="text-\[1[34]px\] leading-6 text-\[var\(--state-warning-text\)\]">\s*\{providerEditorValidationMessage\}/s,
  );
});
