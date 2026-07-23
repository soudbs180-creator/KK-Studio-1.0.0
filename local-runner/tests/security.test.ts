import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { LocalToken } from '../src/security/localToken';
import { isAllowedLocalOrigin, isAllowedLoopbackHost } from '../src/security/originGuard';

test('LocalToken persists a strong token and rejects the legacy fallback', (context) => {
  const stateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-local-token-'));
  context.after(() => fs.rmSync(stateDirectory, { recursive: true, force: true }));

  const tokenPath = path.join(stateDirectory, 'runner-token');
  const tokenStore = new LocalToken({ tokenPath });
  const storedToken = fs.readFileSync(tokenPath, 'utf8').trim();
  const wrongSuffix = storedToken.endsWith('0') ? '1' : '0';

  assert.match(storedToken, /^[a-f0-9]{64}$/);
  assert.equal(tokenStore.validate(`Bearer ${storedToken}`), true);
  assert.equal(tokenStore.validate('local_handshake_token_default'), false);
  assert.equal(tokenStore.validate(`${storedToken.slice(0, -1)}${wrongSuffix}`), false);
});

test('LocalToken fails closed when its credential file cannot be written', (context) => {
  const stateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-local-token-error-'));
  context.after(() => fs.rmSync(stateDirectory, { recursive: true, force: true }));

  assert.throws(
    () => new LocalToken({ tokenPath: stateDirectory }),
    /Local Runner token initialization failed/,
  );
});

test('local runner only accepts exact loopback Origin and Host values', () => {
  assert.equal(isAllowedLocalOrigin('http://localhost:5173'), true);
  assert.equal(isAllowedLocalOrigin('https://127.0.0.1:5173'), true);
  assert.equal(isAllowedLocalOrigin('http://[::1]:5173'), true);
  assert.equal(isAllowedLocalOrigin('http://localhost.example.com:5173'), false);
  assert.equal(isAllowedLocalOrigin('https://kk.example.com'), false);

  assert.equal(isAllowedLoopbackHost('localhost:9099'), true);
  assert.equal(isAllowedLoopbackHost('127.0.0.1:9099'), true);
  assert.equal(isAllowedLoopbackHost('[::1]:9099'), true);
  assert.equal(isAllowedLoopbackHost('localhost:9099.example.com'), false);
  assert.equal(isAllowedLoopbackHost('kk.example.com:9099'), false);
});
