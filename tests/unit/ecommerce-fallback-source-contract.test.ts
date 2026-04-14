import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce analysis accepts document fallback formats and routes them through text fallback analysis', () => {
  const routeSource = readSource('api/ecommerce-analysis.ts');
  const importPanelSource = readSource('src/components/ecommerce/EcommerceImportPanel.tsx');
  const fallbackSource = readSource('src/services/ecommerce/text/fallbackTextAnalysis.ts');

  assert.match(routeSource, /lowerName\.endsWith\('\.xlsx'\)/);
  assert.doesNotMatch(routeSource, /lowerName\.endsWith\('\.xls'\)/);
  assert.match(routeSource, /lowerName\.endsWith\('\.pdf'\)/);
  assert.match(routeSource, /lowerName\.endsWith\('\.docx'\)/);
  assert.match(routeSource, /lowerName\.endsWith\('\.doc'\)/);
  assert.match(routeSource, /lowerName\.endsWith\('\.txt'\)/);
  assert.match(routeSource, /lowerName\.endsWith\('\.md'\)/);
  assert.match(routeSource, /extractTextForFallback/);
  assert.match(routeSource, /analyzeEcommerceTextFallback/);
  assert.match(importPanelSource, />上传需求单</);
  assert.match(importPanelSource, /支持 xlsx \/ pdf \/ doc \/ docx \/ txt \/ md/);
  assert.match(importPanelSource, /accept="\.xlsx,\.pdf,\.doc,\.docx,\.txt,\.md"/);
  assert.match(fallbackSource, /当前结果来自文档文本回退分析/);
  assert.match(fallbackSource, /export const analyzeEcommerceTextFallback = analyzeFallbackEcommerceText;/);
});
