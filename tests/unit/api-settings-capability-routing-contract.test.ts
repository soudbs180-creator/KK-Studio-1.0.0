import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ApiSettingsView adds route pool, capability roles, and OCR sections without changing official vs proxy validation rules', () => {
  const typesSource = readSource('apps/web/src/types.ts');
  const sectionsSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
  const viewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');

  assert.match(typesSource, /export interface CapabilityRouteAssignment/);
  assert.match(typesSource, /export interface OcrServiceSettings/);

  assert.match(sectionsSource, /export const ApiWorkbenchRoutePoolSection/);
  assert.match(sectionsSource, /export const ApiWorkbenchCapabilitySection/);
  assert.match(sectionsSource, /export const ApiWorkbenchOcrSection/);
  assert.match(sectionsSource, /Unified route pool/);
  assert.match(sectionsSource, /Capability roles/);
  assert.match(sectionsSource, /Prompt AI enhancement/);
  assert.match(sectionsSource, /OCR service/);

  assert.match(viewSource, /<ApiWorkbenchRoutePoolSection/);
  assert.match(viewSource, /<ApiWorkbenchCapabilitySection/);
  assert.match(viewSource, /<ApiWorkbenchOcrSection/);
  assert.match(viewSource, /Enter the API key before saving\./);
  assert.match(viewSource, /providerEditorValidationMessage[\s\S]*name, base URL, and API key/i);
});
