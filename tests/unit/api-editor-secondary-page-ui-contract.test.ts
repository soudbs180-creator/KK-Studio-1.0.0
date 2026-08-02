import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('API secondary pages share one connection editor hierarchy', () => {
  const viewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const editorSource = readSource('apps/web/src/components/settings/ApiConnectionEditor.tsx');

  assert.match(viewSource, /ApiConnectionEditorShell/);
  assert.match(viewSource, /ApiConnectionEditorSection/);
  assert.match(viewSource, /ApiModelCapabilityEditor/);
  assert.match(viewSource, /Provider name/);
  assert.match(viewSource, /Protocol format/);
  assert.match(viewSource, /modelsText/);
  assert.doesNotMatch(viewSource, /<InfoCell[\s\S]*Current object/);
  assert.match(editorSource, /settings-api-editor__hero/);
  assert.match(editorSource, /settings-api-editor__layout/);
  assert.match(editorSource, /settings-api-editor__footer/);
});

test('model selection surfaces only capabilities from the existing capability source', () => {
  const editorSource = readSource('apps/web/src/components/settings/ApiConnectionEditor.tsx');
  const presetSource = readSource('apps/web/src/components/settings/apiProviderPresets.ts');

  assert.match(editorSource, /getModelCapabilityLabels/);
  assert.match(editorSource, /settings-api-editor-model__capabilities/);
  assert.match(editorSource, /Capabilities are read from the shared model registry/);
  assert.match(presetSource, /modelsText:\s*preset\.modelId\s*\|\|\s*''/);
});

test('API editor keeps a two-column desktop layout and one-column mobile layout', () => {
  const styles = readSource('apps/web/src/styles/settings-ui-v4.css');

  assert.match(styles, /\.settings-api-editor__layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.55fr\)\s+minmax\(260px,\s*0\.75fr\)/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.settings-api-editor__layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.settings-api-editor-model__textarea\s*\{/);
  assert.match(styles, /\.settings-api-editor__footer\s*\{[^}]*position:\s*static/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.settings-api-editor__hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
