import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  appendVoiceTranscript,
  resolveSpeechRecognitionConstructor,
} from '../../apps/web/src/components/layout/prompt-bar/promptVoiceInput.ts';

test('voice transcripts append with one readable separator and ignore empty fragments', () => {
  assert.equal(appendVoiceTranscript('生成一张海报', '加入蓝色霓虹'), '生成一张海报 加入蓝色霓虹');
  assert.equal(appendVoiceTranscript('', '  开始创作  '), '开始创作');
  assert.equal(appendVoiceTranscript('保持现状', '   '), '保持现状');
});

test('voice input supports the standard and WebKit speech recognition constructors', () => {
  const standard = function StandardRecognition() {};
  const webkit = function WebkitRecognition() {};

  assert.equal(
    resolveSpeechRecognitionConstructor({
      SpeechRecognition: standard,
      webkitSpeechRecognition: webkit,
    }),
    standard,
  );
  assert.equal(
    resolveSpeechRecognitionConstructor({ webkitSpeechRecognition: webkit }),
    webkit,
  );
  assert.equal(resolveSpeechRecognitionConstructor({}), null);
});
