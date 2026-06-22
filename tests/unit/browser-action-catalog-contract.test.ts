import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BROWSER_ACTIONS,
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
  assert.equal(getBrowserActionByToolName('browser.writeBackDom')?.permission, 'dangerous');

  assert.equal(getBrowserActionByCommandKind('extract_product')?.toolName, 'browser.extractProduct');
  assert.equal(getBrowserActionByCommandKind('generate_external')?.toolName, 'browser.generateExternal');
  assert.equal(getBrowserActionByCommandKind('publish_draft')?.toolName, 'browser.publishDraft');
  assert.equal(getBrowserActionByCommandKind('write_back_dom')?.toolName, 'browser.writeBackDom');
});

test('Browser tools and Browser Assistant buttons consume the shared browser action catalog', () => {
  const toolSource = readSource('apps/web/src/features/ai-assistant-runtime/tools/browserTools.ts');
  const viewSource = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');

  assert.match(toolSource, /BROWSER_ACTIONS/);
  assert.doesNotMatch(toolSource, /kind: 'extract_product'/);
  assert.doesNotMatch(toolSource, /kind: 'generate_external'/);
  assert.doesNotMatch(toolSource, /kind: 'publish_draft'/);
  assert.doesNotMatch(toolSource, /kind: 'write_back_dom'/);

  assert.match(viewSource, /BROWSER_ACTIONS/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.getStatus\.toolName\}/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.extractProduct\.toolName\}/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.generateExternal\.toolName\}/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.publishDraft\.toolName\}/);
  assert.match(viewSource, /data-browser-tool=\{BROWSER_ACTIONS\.writeBackDom\.toolName\}/);
});
