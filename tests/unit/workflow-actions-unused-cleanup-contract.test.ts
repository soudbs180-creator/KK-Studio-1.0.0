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

test('empty canvas welcome stays above workspace chrome without being hidden by prompt controls', () => {
  const welcomeSource = readSource('apps/web/src/landing/EmptyCanvasWelcome.tsx');
  const canvasCssSource = readSource('apps/web/src/styles/canvas.css');

  assert.match(welcomeSource, /empty-canvas-welcome-layer/);
  assert.match(welcomeSource, /empty-canvas-welcome-panel/);
  assert.match(
    canvasCssSource,
    /\.empty-canvas-welcome-layer\s*\{[\s\S]*z-index:\s*90;[\s\S]*inset:\s*clamp\(64px,[\s\S]*clamp\(136px,/,
  );
  assert.match(
    canvasCssSource,
    /\.empty-canvas-welcome-panel\s*\{[\s\S]*width:\s*min\(100%,\s*600px\);[\s\S]*max-height:\s*min\(100%,\s*460px\);/,
  );
  assert.match(welcomeSource, /aria-labelledby="empty-canvas-title"/);
});

test('empty canvas API settings entry is a semantic command', () => {
  const welcomeSource = readSource('apps/web/src/landing/EmptyCanvasWelcome.tsx');

  assert.match(
    welcomeSource,
    /<button[\s\S]*type="button"[\s\S]*onClick=\{onOpenSettings\}[\s\S]*配置模型/,
  );
  assert.doesNotMatch(welcomeSource, /<div[^>]*onClick=\{onOpenSettings\}/);
});
