import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readWebSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, 'apps', 'web', 'src', relativePath), 'utf8');
}

// ---------------------------------------------------------------------------
// 回归守护：访客（临时）会话按设计没有托管 JWT —— POST /api/v1/auth/temp-users
// 只返回身份信息、不签发 token。因此「托管会话刷新失败」与「某接口回 401」
// 对访客都是预期结果，不能据此清空运行时状态。
//
// 该缺陷曾真实存在且只在后端**可用**时复现：后端不可用时刷新是网络错误、不带
// 鉴权失败码，反而不会触发清除；后端可用时返回明确的鉴权失败码，访客登录成功
// 后约 1 秒即被踢回落地页（实测 t=2500ms auth=set → t=3500ms auth=null）。
// ---------------------------------------------------------------------------

const SOURCE = 'services/api/authAccessToken.ts';

test('guest sessions are recognised before any hosted-session invalidation', () => {
  const source = readWebSource(SOURCE);

  assert.match(
    source,
    /function isGuestRuntimeSession\(\)/,
    '必须有判定当前是否为访客会话的守卫'
  );
  assert.match(
    source,
    /getLatestRuntimeAuthState\(\)\.isTempUser/,
    '守卫必须依据运行时状态的 isTempUser 判定'
  );
});

test('every hosted-session invalidation in the token module is guarded for guests', () => {
  const source = readWebSource(SOURCE);

  const calls = source.match(/clearHostedSessionRuntime\(\)/g) || [];
  assert.ok(calls.length >= 2, `预期至少 2 处失效调用，实际 ${calls.length} 处`);

  // 每一处 clearHostedSessionRuntime() 调用前都必须有 !isGuestRuntimeSession() 守卫。
  // 逐段切分而不是全局计数，避免「一处有守卫、另一处漏掉」被放过。
  const segments = source.split(/clearHostedSessionRuntime\(\)/);
  // 最后一段在最后一次调用之后，不需要检查。
  for (let index = 0; index < segments.length - 1; index += 1) {
    const preceding = segments[index].slice(-260);
    assert.match(
      preceding,
      /if \(!isGuestRuntimeSession\(\)\)/,
      `第 ${index + 1} 处 clearHostedSessionRuntime() 之前缺少访客守卫`
    );
  }
});

test('the temp-user endpoint contract still issues no access token', () => {
  // 若将来 temp-users 开始签发 token，本守卫的前提就变了，应一并重新评估。
  const client = readFileSync(
    path.join(ROOT_DIR, 'packages', 'shared', 'src', 'contracts', 'client', 'kk-api-client.ts'),
    'utf8'
  );
  const marker = client.indexOf('createTempUser(options)');
  assert.ok(marker > -1, 'createTempUser 应存在于 API 客户端');

  const block = client.slice(marker, marker + 320);
  assert.match(block, /api\/v1\/auth\/temp-users/);
  assert.doesNotMatch(
    block,
    /accessToken|refreshToken/,
    'temp-users 若开始返回 token，需重新评估访客守卫的必要性'
  );
});
