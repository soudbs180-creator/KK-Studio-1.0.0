import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('workflow actions keep template list ownership in EmptyCanvasWelcome', () => {
  const hookSource = readSource('apps/web/src/app/useWorkflowActions.ts');
  const welcomeSource = readSource('apps/web/src/landing/EmptyCanvasWelcome.tsx');
  const templateSource = readSource('apps/web/src/workflow/templates/workflowTemplates.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/workflow-actions-unused-cleanup-contract\.test\.ts/);
  assert.match(hookSource, /type WorkflowTemplateId/);
  assert.match(hookSource, /createAgentWorkflowNode/);
  assert.match(hookSource, /createPreviewWorkflowNode/);
  assert.match(hookSource, /createSaveWorkflowNode/);
  assert.doesNotMatch(hookSource, /\bWORKFLOW_TEMPLATES\b/);

  assert.match(welcomeSource, /WORKFLOW_TEMPLATES/);
  assert.match(templateSource, /export const WORKFLOW_TEMPLATES/);
});

