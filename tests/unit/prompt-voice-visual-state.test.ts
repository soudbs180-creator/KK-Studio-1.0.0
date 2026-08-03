import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('voice input exposes supported and listening state to the UI', () => {
  const voiceSource = readSource('apps/web/src/components/layout/prompt-bar/PromptVoiceInputButton.tsx');
  const workspaceStyleSource = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.match(voiceSource, /data-state=\{isListening \? 'listening' : 'idle'\}/);
  assert.match(voiceSource, /data-supported=\{isSupported\}/);
  assert.match(voiceSource, /aria-live="polite"/);
  assert.match(voiceSource, /className="kk-composer-voice-status"/);
  assert.match(voiceSource, /showFeedback\('当前浏览器不支持语音识别'/);
  assert.doesNotMatch(voiceSource, /disabled=\{!isSupported\}/);
  assert.match(workspaceStyleSource, /\.kk-composer-voice-input\[data-state='listening'\][\s\S]*animation:\s*kk-voice-recording-pulse/);
});
