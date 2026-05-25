import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('workflow actions keep template list ownership in App', () => {
  const hookSource = readSource('src/app/useWorkflowActions.ts');
  const appSource = readSource('src/App.tsx');
  const templateSource = readSource('src/workflow/templates/workflowTemplates.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/workflow-actions-unused-cleanup-contract\.test\.ts/);
  assert.match(hookSource, /type WorkflowTemplateId/);
  assert.match(hookSource, /createAgentWorkflowNode/);
  assert.match(hookSource, /createPreviewWorkflowNode/);
  assert.match(hookSource, /createSaveWorkflowNode/);
  assert.doesNotMatch(hookSource, /\bWORKFLOW_TEMPLATES\b/);

  assert.match(appSource, /WORKFLOW_TEMPLATES/);
  assert.match(appSource, /workflowTemplates=\{WORKFLOW_TEMPLATES\}/);
  assert.match(templateSource, /export const WORKFLOW_TEMPLATES/);
});
