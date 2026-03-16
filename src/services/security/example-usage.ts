/**
 * Safe usage examples for the hardened API-key storage layer.
 * These examples intentionally avoid returning raw provider keys to the browser.
 */

import { addUserApiKey, callAiApiSecure } from './apiKeySecureStorage';
import {
  callSecureSystemProxyChat,
  callSecureSystemProxyImage,
} from '../model/secureModelProxy';

export async function exampleSimpleChat() {
  const result = await callAiApiSecure(
    'gemini-pro',
    [{ role: 'user', content: '你好，请简单介绍一下自己。' }],
    { temperature: 0.7 },
  );

  return result.content;
}

export async function exampleSecureProxyChat(modelId: string, content: string) {
  const result = await callSecureSystemProxyChat({
    modelId,
    messages: [{ role: 'user', content }],
    stream: false,
  });

  return result.content;
}

export async function exampleImageGeneration(prompt: string) {
  const result = await callSecureSystemProxyImage({
    modelId: 'gpt-image-1',
    prompt,
    imageCount: 1,
  });

  return result.urls[0] || '';
}

export async function exampleStoreUserKey() {
  return addUserApiKey(
    'My Gemini Key',
    'Google',
    'replace-with-a-real-key-before-running',
  );
}

export const secureKeyManager = {
  async hasKeyForModel(): Promise<boolean> {
    return true;
  },

  async getKeyForModel(): Promise<string | null> {
    throw new Error('Raw provider key access is disabled. Use secure-model-proxy instead.');
  },

  async getModelConfig() {
    throw new Error('Direct model config retrieval is disabled. Use secure-model-proxy instead.');
  },
};

export async function runTests() {
  try {
    const result = await exampleSimpleChat();
    console.log('secure chat ok:', result);
  } catch (error) {
    console.error('secure chat failed:', error);
  }
}
