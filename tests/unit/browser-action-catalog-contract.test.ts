import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BROWSER_ACTIONS,
  BROWSER_LOCAL_ACTIONS,
  getBrowserActionByCommandKind,
  getBrowserActionByToolName,
} from '../../apps/web/src/features/ai-assistant-runtime/browser/browserActionCatalog.ts';
import { readSource } from '../support/workspacePaths.js';

test('Browser action catalog is the single source for browser tool permissions and command kinds', () => {
  const actions = Object.values(BROWSER_ACTIONS);
  const toolNames = actions.map(action => action.toolName);
  const commandKinds = actions.map(action => action.commandKind).filter(Boolean);

  assert.equal(new Set(toolNames).size, toolNames.length);
  assert.equal(new Set(commandKinds).size, commandKinds.length);

  assert.equal(getBrowserActionByToolName('browser.getStatus')?.permission, 'safe');
  assert.equal(getBrowserActionByToolName('browser.openAssistant')?.permission, 'safe');
  assert.equal(getBrowserActionByToolName('browser.extractProduct')?.permission, 'confirm');
  assert.equal(getBrowserActionByToolName('browser.generateExternal')?.permission, 'confirm');
  assert.equal(getBrowserActionByToolName('browser.publishDraft')?.permission, 'confirm');
  assert.equal(getBrowserActionByToolName('browser.inspectPage')?.permission, 'confirm');
  assert.equal(getBrowserActionByToolName('browser.openDesktopProject')?.permission, 'confirm');
  assert.equal(getBrowserActionByToolName('browser.checkLocalLlm')?.permission, 'safe');
  assert.equal(getBrowserActionByToolName('browser.writeBackDom')?.permission, 'dangerous');

  assert.equal(getBrowserActionByCommandKind('extract_product')?.toolName, 'browser.extractProduct');
  assert.equal(getBrowserActionByCommandKind('generate_external')?.toolName, 'browser.generateExternal');
  assert.equal(getBrowserActionByCommandKind('publish_draft')?.toolName, 'browser.publishDraft');
  assert.equal(getBrowserActionByCommandKind('inspect_page')?.toolName, 'browser.inspectPage');
  assert.equal(getBrowserActionByCommandKind('open_desktop_project')?.toolName, 'browser.openDesktopProject');
  assert.equal(getBrowserActionByCommandKind('check_local_llm')?.toolName, 'browser.checkLocalLlm');
  assert.equal(getBrowserActionByCommandKind('write_back_dom')?.toolName, 'browser.writeBackDom');
});

test('Browser local action catalog names station-internal assistant actions and their ToolRegistry mapping', () => {
  const actions = Object.values(BROWSER_LOCAL_ACTIONS);
  const actionNames = actions.map(action => action.actionName);

  assert.equal(new Set(actionNames).size, actionNames.length);
  assert.ok(actionNames.every(actionName => actionName.startsWith('browser.local.')));

  assert.equal(BROWSER_LOCAL_ACTIONS.importProductToCanvas.agentToolName, 'canvas.createPromptCards');
  assert.equal(BROWSER_LOCAL_ACTIONS.createCanvasPromptCard.agentToolName, 'canvas.createPromptCards');
  assert.equal(BROWSER_LOCAL_ACTIONS.zipOriginals.agentToolName, 'assets.zipOriginals');
  assert.equal(BROWSER_LOCAL_ACTIONS.locateZippedFile.agentToolName, undefined);
  assert.equal(BROWSER_LOCAL_ACTIONS.runPipeline.agentToolName, undefined);
  assert.equal(BROWSER_LOCAL_ACTIONS.importClipboardPayload.agentToolName, 'canvas.createPromptCards');
});

test('Browser tools and Browser Assistant buttons consume the shared browser action catalog', () => {
  const toolSource = readSource('apps/web/src/features/ai-assistant-runtime/tools/browserTools.ts');
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');

  assert.match(toolSource, /BROWSER_ACTIONS/);
  assert.doesNotMatch(toolSource, /kind: 'extract_product'/);
  assert.doesNotMatch(toolSource, /kind: 'generate_external'/);
  assert.doesNotMatch(toolSource, /kind: 'publish_draft'/);
  assert.doesNotMatch(toolSource, /kind: 'inspect_page'/);
  assert.doesNotMatch(toolSource, /kind: 'open_desktop_project'/);
  assert.doesNotMatch(toolSource, /kind: 'check_local_llm'/);
  assert.doesNotMatch(toolSource, /kind: 'write_back_dom'/);

  assert.match(viewSource, /BROWSER_ACTIONS/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.getStatus\.toolName\}/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.extractProduct\.toolName\}/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.generateExternal\.toolName\}/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.publishDraft\.toolName\}/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.inspectPage\.toolName\}/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.openDesktopProject\.toolName\}/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.checkLocalLlm\.toolName\}/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.writeBackDom\.toolName\}/);

  assert.match(viewSource, /BROWSER_LOCAL_ACTIONS/);
  assert.match(viewSource, /data-browser-local-action=\{BROWSER_LOCAL_ACTIONS\.importProductToCanvas\.actionName\}/);
  assert.match(viewSource, /data-agent-tool=\{BROWSER_LOCAL_ACTIONS\.importProductToCanvas\.agentToolName\}/);
  assert.match(viewSource, /data-browser-local-action=\{BROWSER_LOCAL_ACTIONS\.createCanvasPromptCard\.actionName\}/);
  assert.match(viewSource, /data-agent-tool=\{BROWSER_LOCAL_ACTIONS\.createCanvasPromptCard\.agentToolName\}/);
  assert.match(viewSource, /data-browser-local-action=\{BROWSER_LOCAL_ACTIONS\.zipOriginals\.actionName\}/);
  assert.match(viewSource, /data-agent-tool=\{BROWSER_LOCAL_ACTIONS\.zipOriginals\.agentToolName\}/);
  assert.match(viewSource, /data-browser-local-action=\{BROWSER_LOCAL_ACTIONS\.locateZippedFile\.actionName\}/);
  assert.match(viewSource, /data-browser-local-action=\{BROWSER_LOCAL_ACTIONS\.runPipeline\.actionName\}/);
  assert.match(viewSource, /data-browser-local-action=\{BROWSER_LOCAL_ACTIONS\.importClipboardPayload\.actionName\}/);
  assert.match(viewSource, /data-agent-tool=\{BROWSER_LOCAL_ACTIONS\.importClipboardPayload\.agentToolName\}/);
});

test('Browser Assistant pipeline button declares the Browser Bridge tool it executes', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const marker = 'data-browser-local-action={BROWSER_LOCAL_ACTIONS.runPipeline.actionName}';
  const markerIndex = viewSource.indexOf(marker);
  assert.notEqual(markerIndex, -1, 'Missing Browser Assistant pipeline button local action marker');

  const buttonStart = viewSource.lastIndexOf('<button', markerIndex);
  const buttonEnd = viewSource.indexOf('>', markerIndex);
  assert.notEqual(buttonStart, -1, 'Missing Browser Assistant pipeline button start');
  assert.notEqual(buttonEnd, -1, 'Missing Browser Assistant pipeline button opening tag end');

  const openingTag = viewSource.slice(buttonStart, buttonEnd);
  assert.match(openingTag, /data-browser-tool=\{BROWSER_ACTIONS\.generateExternal\.toolName\}/);
  assert.match(openingTag, /data-browser-command-kind=\{BROWSER_ACTIONS\.generateExternal\.commandKind\}/);
});
