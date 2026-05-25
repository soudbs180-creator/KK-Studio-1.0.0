import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('PromptNodeComponent presents optimizer output as strategy guidance instead of raw debug fields', () => {
  const promptNodeSource = readSource('src/components/canvas/PromptNodeComponent.tsx');

  assert.match(promptNodeSource, /const getOptimizerStrategySummaryZh =/);
  assert.match(promptNodeSource, /自动策略说明/);
  assert.match(promptNodeSource, /建议补充（可选）/);
  assert.match(promptNodeSource, /当前这次优化会优先补齐/);
});
