import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const API_SETTINGS_VIEW_PATH = 'apps/web/src/components/settings/ApiSettingsView.tsx';



test('ApiSettingsView keeps editor save buttons behind inline validation feedback', () => {
  const source = readSource(API_SETTINGS_VIEW_PATH);

  assert.match(source, /const officialEditorValidationMessage = \(\(\) => \{/);
  assert.match(source, /return pick\('先填写 API Key 才能保存。', 'Enter the API key before saving\.'\);/);
  assert.match(source, /return pick\('请重新输入真实 API Key。', 'Re-enter the real API key before saving\.'\);/);
  assert.match(source, /<PrimaryButton disabled=\{userApiActionsDisabled \|\| Boolean\(officialEditorValidationMessage\)\}/);
  assert.match(source, /const resetOfficialDraft = \(\) => \{[\s\S]*setOfficialForm\(buildOfficialDraft\(officialForm\.provider\)\);[\s\S]*\};/);
  assert.match(source, /<SecondaryButton onClick=\{editingOfficialId \? cancelEdit : resetOfficialDraft\}(?:\s+controlAction=\{[^}]+\})?>/);
  assert.match(
    source,
    /<span>\{officialEditorValidationMessage \|\| pick\([\s\S]*?\)\}<\/span>/,
  );

  assert.match(source, /const providerEditorValidationMessage = \(\(\) => \{/);
  assert.match(
    source,
    /return pick\('补全名称、Base URL 和 API Key 后才能保存。', 'Complete the name, base URL, and API key before saving\.'\);/,
  );
  assert.match(source, /<PrimaryButton disabled=\{providerActionsDisabled \|\| Boolean\(providerEditorValidationMessage\)\}/);
  assert.match(source, /const resetProviderDraft = \(\) => \{[\s\S]*setProviderForm\(providerDefaults\);[\s\S]*\};/);
  assert.match(source, /<SecondaryButton onClick=\{editingProviderId \? cancelEdit : resetProviderDraft\}(?:\s+controlAction=\{[^}]+\})?>/);
  assert.match(
    source,
    /<span>\{providerEditorValidationMessage \|\| pick\([\s\S]*?\)\}<\/span>/,
  );
});
