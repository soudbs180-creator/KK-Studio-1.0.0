import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readSource } from '../support/workspacePaths.js';

const root = process.cwd();

const extractBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);

  return source.slice(startIndex, endIndex);
};

test('AI control execution has one production path through AgentRuntime and runtime ToolRegistry', () => {
  assert.equal(
    fs.existsSync(path.join(root, 'apps/web/src/features/ai-takeover/core/actionExecutor.ts')),
    false,
    'legacy actionExecutor.ts should not remain as a second AI execution path'
  );

  assert.equal(
    fs.existsSync(path.join(root, 'apps/web/src/features/ai-takeover/core/toolRegistry.ts')),
    false,
    'legacy ai-takeover/core/toolRegistry.ts wrapper should not remain as a second ToolRegistry entry'
  );

  const takeoverContext = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
  assert.match(takeoverContext, /agentRuntimeInstance\.executePendingRun/);
  assert.doesNotMatch(takeoverContext, /executeAction/);
  assert.doesNotMatch(takeoverContext, /generationQueue/);
  assert.doesNotMatch(takeoverContext, /addToQueue/);

  const toolRegistryDoc = readSource('docs/ai-assistant/tool-registry.md');
  const moduleMap = readSource('docs/ai-assistant/module-map.md');
  const flowMap = readSource('docs/ai-assistant/flow-map.md');
  const combinedDocs = `${toolRegistryDoc}\n${moduleMap}\n${flowMap}`;

  assert.match(combinedDocs, /apps\/web\/src\/features\/ai-assistant-runtime\/tools\/ToolRegistry\.ts/);
  assert.doesNotMatch(combinedDocs, /apps\/web\/src\/features\/ai-takeover\/core\/toolRegistry\.ts/);
  assert.doesNotMatch(combinedDocs, /apps\/web\/src\/features\/ai-takeover\/core\/actionExecutor\.ts/);
});

test('Browser Assistant canvas import event delegates to ToolRegistry createPromptCards', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const eventBridge = extractBetween(
    appSource,
    "const handleCreatePromptCards = async (e: Event) => {",
    "window.addEventListener('takeover-create-prompt-cards', handleCreatePromptCards);"
  );

  assert.match(eventBridge, /toolRegistryInstance\.execute\('canvas\.createPromptCards'/);
  assert.doesNotMatch(eventBridge, /const promptNode:/);
  assert.doesNotMatch(eventBridge, /const imageNode:/);
  assert.doesNotMatch(eventBridge, /addPromptNode\(promptNode\)/);
  assert.doesNotMatch(eventBridge, /addImageNodes\(\[imageNode\]\)/);
});

test('Browser Assistant ZIP export event delegates to ToolRegistry assets.zipOriginals', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const eventBridge = extractBetween(
    appSource,
    "const handleZipOriginals = async (e: Event) => {",
    "window.addEventListener('takeover-zip-originals', handleZipOriginals);"
  );

  assert.match(eventBridge, /toolRegistryInstance\.execute\('assets\.zipOriginals'/);
  assert.doesNotMatch(eventBridge, /zipOutputs\(/);
});

test('Browser Assistant ZIP button dispatches the runtime ZIP event without dev fallback simulation', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const handler = extractBetween(
    viewSource,
    'const handleZipOriginals = () => {',
    'const handleLocateZippedFile = () => {'
  );

  assert.match(handler, /window\.dispatchEvent\(new CustomEvent\('takeover-zip-originals'/);
  assert.doesNotMatch(handler, /daemonStatus/);
  assert.doesNotMatch(handler, /devFallback/);
  assert.doesNotMatch(handler, /setZipLoading\(true\)/);
  assert.doesNotMatch(handler, /window\.setInterval/);
  assert.doesNotMatch(handler, /\[Dev Fallback\]/);
});

test('Browser Assistant status check buttons read Browser Bridge status through ToolRegistry', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const handlers = [
    extractBetween(viewSource, 'const checkPlatformLogin =', 'const togglePlatform ='),
    extractBetween(viewSource, 'const checkSocialLogin =', 'const toggleSocialChannel ='),
    extractBetween(viewSource, 'const checkSessionLogin =', 'const handleSelectSessionToggle =')
  ];

  for (const handler of handlers) {
    assert.match(handler, /toolRegistryInstance\.execute\('browser\.getStatus'/);
    assert.doesNotMatch(handler, /Math\.random/);
    assert.doesNotMatch(handler, /window\.setTimeout/);
    assert.doesNotMatch(handler, /devFallback/);
  }
});

test('Browser Assistant Connectivity Doctor reads Browser Bridge status through ToolRegistry', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const handler = extractBetween(
    viewSource,
    'const checkConnectivity =',
    'const checkPlatformLogin ='
  );

  assert.match(handler, /toolRegistryInstance\.execute\('browser\.getStatus'/);
  assert.match(handler, /applyBrowserStatusSnapshot/);
  assert.doesNotMatch(handler, /window\.setTimeout/);
  assert.doesNotMatch(handler, /daemonStatus === 'connected'/);
});

test('Browser Assistant ZIP locate action does not fake local file manager success', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const handler = extractBetween(
    viewSource,
    'const handleLocateZippedFile = () => {',
    'const [platforms'
  );

  assert.doesNotMatch(handler, /C:\/Users/);
  assert.doesNotMatch(handler, /Explorer/);
  assert.doesNotMatch(handler, /notify\.success/);
  assert.match(handler, /zippedFileLoc/);
});

test('Browser Assistant pipeline runs through Browser Bridge runtime instead of Worker simulation', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const handler = extractBetween(
    viewSource,
    'const handleRunPipeline =',
    'const handlePreviewTakeoverPlan ='
  );

  assert.match(handler, /dispatchBrowserCommand\(/);
  assert.match(handler, /BROWSER_ACTIONS\.generateExternal\.commandKind/);
  assert.doesNotMatch(handler, /workerRef\.current\.postMessage/);
  assert.doesNotMatch(handler, /pipeline_step/);
  assert.doesNotMatch(handler, /pipeline_done/);
  assert.doesNotMatch(handler, /\[Dev Fallback\]/);

  assert.doesNotMatch(viewSource, /task === 'pipeline'/);
  assert.doesNotMatch(viewSource, /type: 'pipeline_step'/);
  assert.doesNotMatch(viewSource, /type: 'pipeline_done'/);
});

test('Browser Assistant clipboard import delegates sensed payloads to canvas prompt card runtime', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const handler = extractBetween(
    viewSource,
    'const handleImportClipboardPayload =',
    'const handleScreenInspect ='
  );

  assert.match(handler, /window\.dispatchEvent\(new CustomEvent\('takeover-create-prompt-cards'/);
  assert.match(handler, /clipboardPayload\.content/);
  assert.match(handler, /setClipboardPayload\(null\)/);
  assert.doesNotMatch(handler, /自动解析/);
  assert.doesNotMatch(handler, /notify\.success\('导入成功'/);
});

test('Browser Assistant clipboard capture reads the browser clipboard instead of injecting sample data', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const handler = extractBetween(
    viewSource,
    'const handleReadClipboardPayload =',
    'const handleImportClipboardPayload ='
  );

  assert.match(handler, /navigator\.clipboard\.readText\(\)/);
  assert.doesNotMatch(handler, /detail\.tmall\.com/);
  assert.doesNotMatch(handler, /已被注入模拟/);
  assert.doesNotMatch(viewSource, />\s*模拟剪贴板复制\s*</);
});

test('Browser Assistant screen inspect uses Browser Bridge runtime instead of timed demo results', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const handler = extractBetween(
    viewSource,
    'const handleScreenInspect =',
    'const handleRunPipeline ='
  );

  assert.match(handler, /dispatchBrowserCommand\(/);
  assert.match(handler, /BROWSER_ACTIONS\.inspectPage\.commandKind/);
  assert.match(handler, /setInspectData\(/);
  assert.doesNotMatch(handler, /window\.setTimeout/);
  assert.doesNotMatch(handler, /\[Dev Fallback\]/);
  assert.doesNotMatch(handler, /#0f172a/);
  assert.doesNotMatch(handler, /Sidebar \+ Content Stream/);
  assert.doesNotMatch(handler, /1599/);
});

test('Browser Assistant desktop adapter test uses Browser Bridge instead of dev fallback success', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const handler = extractBetween(
    viewSource,
    'const handleTestIde =',
    'const handleZipOriginals ='
  );

  assert.match(handler, /dispatchBrowserCommand\(/);
  assert.match(handler, /BROWSER_ACTIONS\.openDesktopProject\.commandKind/);
  assert.match(handler, /setDesktopStatus\(/);
  assert.doesNotMatch(handler, /window\.setTimeout/);
  assert.doesNotMatch(handler, /devFallback/);
  assert.doesNotMatch(handler, /\[Dev Fallback\]/);
});

test('Browser Assistant local LLM gateway test uses Browser Bridge instead of dev fallback success', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const handler = extractBetween(
    viewSource,
    'const handleTestLocalLlm =',
    'const handleReadClipboardPayload ='
  );

  assert.match(handler, /dispatchBrowserCommand\(/);
  assert.match(handler, /BROWSER_ACTIONS\.checkLocalLlm\.commandKind/);
  assert.match(handler, /setLocalLlmStatus\(/);
  assert.doesNotMatch(handler, /window\.setTimeout/);
  assert.doesNotMatch(handler, /fetch\(\`\$\{localLlmEndpoint\}\/api\/tags\`/);
  assert.doesNotMatch(handler, /devFallback/);
  assert.doesNotMatch(handler, /\[Dev Fallback\]/);
});

test('Browser Assistant settings surface no longer exposes a dead Dev Fallback toggle', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');

  assert.doesNotMatch(viewSource, /devFallback/);
  assert.doesNotMatch(viewSource, /kk_browser_dev_fallback/);
  assert.doesNotMatch(viewSource, /\[Dev Fallback\]/);
  assert.doesNotMatch(viewSource, />\s*演示数据 \(Dev Fallback\)\s*</);
});

test('Browser Assistant runtime surface no longer labels live Bridge flows as simulation', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');

  assert.doesNotMatch(viewSource, /仿真/);
  assert.doesNotMatch(viewSource, /模拟/);
});

test('Browser Assistant auto clipping worker does not replace product images with a stock demo asset', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const worker = extractBetween(
    viewSource,
    'const workerCode = `',
    '`;\n\nexport const BrowserAssistantView'
  );
  const importHandler = extractBetween(
    viewSource,
    'const handleImportToCanvasWithClip = () => {',
    'const handleWriteBackDom ='
  );

  assert.doesNotMatch(worker, /images\.unsplash\.com/);
  assert.doesNotMatch(worker, /photo-150574/);
  assert.match(worker, /mode: 'passthrough'/);
  assert.match(worker, /url: data/);
  assert.match(importHandler, /triggerImport\(data\.url \|\| extractedData\.imageUrl, data\.success === true\)/);
});
