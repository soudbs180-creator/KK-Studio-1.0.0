import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('prompt cards surface ecommerce selection and continuation badges on the canvas', () => {
  const promptNodeSource = readSource('src/components/canvas/PromptNodeComponent.tsx');

  assert.match(promptNodeSource, /getEcommerceSelectionBadges/);
  assert.match(promptNodeSource, /getEcommerceStageBadges/);
  assert.match(promptNodeSource, /selectedForGeneration === false/);
  assert.match(promptNodeSource, /activeTaskState/);
  assert.match(promptNodeSource, /sourceRowKey/);
  assert.match(promptNodeSource, /待复核/);
  assert.match(promptNodeSource, /待编辑/);
  assert.match(promptNodeSource, /已确认生成/);
  assert.match(promptNodeSource, /已跳过/);
  assert.match(promptNodeSource, /桌面已确认待手机版/);
  assert.match(promptNodeSource, /桌面待确认/);
  assert.match(promptNodeSource, /手机生成失败/);
  assert.match(promptNodeSource, /编辑中/);
  assert.match(promptNodeSource, /确认生成/);
  assert.match(promptNodeSource, /取消确认/);
});
