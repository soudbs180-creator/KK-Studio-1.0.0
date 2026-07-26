import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const ROOT_DIR = process.cwd();

const { hasUnsafeBaseUrl, resolveProfileUserRoute } = require(
  '../../services/api/routes/user/shared/profileRouteResolver.js'
);

// ---------------------------------------------------------------------------
// 回归守护：BYOK 代理有两条**互相独立**的用户可控出站路径 ——
//   1) `X-Proxy-Target-Url` 请求头
//   2) 用户自建槽位里的 route.baseUrl
// 只修其中一条关不掉漏洞。两条都必须拒绝私有/回环主机与非 http(s) 协议，
// 否则任意登录用户可让服务端读取 127.0.0.1 上的内部服务与云 metadata 端点，
// 且响应体会经错误消息原样回吐（full-read SSRF）。
// ---------------------------------------------------------------------------

const UNSAFE_HOSTS = [
  'http://127.0.0.1:5432/',
  'http://localhost:6379/',
  'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
  'http://10.0.0.5/internal',
  'http://192.168.1.10/admin',
  'http://172.16.0.9/',
  'http://[::1]:8317/v1/models',
  'http://0.0.0.0/',
];

const UNSAFE_SHAPES = [
  'file:///etc/passwd',
  'gopher://127.0.0.1:11211/',
  'ftp://example.com/x',
  'https://user:pass@example.com/',
  'not-a-url',
];

const SAFE_URLS = [
  'https://api.openai.com/v1',
  'https://generativelanguage.googleapis.com',
  'http://api.example.com/v1',
];

test('slot baseUrl guard rejects private, loopback and metadata hosts', () => {
  for (const url of UNSAFE_HOSTS) {
    assert.equal(hasUnsafeBaseUrl({ baseUrl: url }), true, `应拒绝内网目标: ${url}`);
  }
});

test('slot baseUrl guard rejects non-http schemes, embedded credentials and malformed urls', () => {
  for (const url of UNSAFE_SHAPES) {
    assert.equal(hasUnsafeBaseUrl({ baseUrl: url }), true, `应拒绝非法形态: ${url}`);
  }
});

test('slot baseUrl guard still allows legitimate public provider endpoints', () => {
  for (const url of SAFE_URLS) {
    assert.equal(hasUnsafeBaseUrl({ baseUrl: url }), false, `不应误伤合法 Provider: ${url}`);
  }
});

test('empty baseUrl is left to downstream required-field validation', () => {
  assert.equal(hasUnsafeBaseUrl({ baseUrl: '' }), false);
  assert.equal(hasUnsafeBaseUrl({}), false);
});

test('resolveProfileUserRoute drops a route whose baseUrl points at the internal network', async () => {
  const route = await resolveProfileUserRoute('user-1', {}, 'slot-1', {
    resolveProviderConnectionLegacyRoute: async () => null,
    resolveRouteFromProfileState: () => ({ id: 'slot-1', baseUrl: 'http://127.0.0.1:5432/12ai', key: 'k' }),
  });

  assert.equal(route, null, '指向内网的路由必须被当作不存在，避免泄露内部拓扑');
});

test('resolveProfileUserRoute still returns legitimate routes unchanged', async () => {
  const legit = { id: 'slot-2', baseUrl: 'https://api.openai.com/v1', key: 'k' };
  const route = await resolveProfileUserRoute('user-1', {}, 'slot-2', {
    resolveProviderConnectionLegacyRoute: async () => null,
    resolveRouteFromProfileState: () => legit,
  });

  assert.deepEqual(route, legit);
});

test('the header path is guarded independently of the slot path', () => {
  const profile = readFileSync(
    path.join(ROOT_DIR, 'services', 'api', 'routes', 'user', 'profile.js'),
    'utf8'
  );
  const guard = readFileSync(
    path.join(ROOT_DIR, 'services', 'api', 'routes', 'user', 'shared', 'outboundUrlGuard.js'),
    'utf8'
  );

  // 两条路径共用同一守卫模块，避免规则漂移；判定必须复用仓库既有的 isPrivateHost。
  assert.match(guard, /function rejectUnsafeOutboundUrl\(/);
  assert.match(guard, /isPrivateHost\(parsed\.hostname\)/, '守卫必须复用既有的 isPrivateHost，不得另起规则');

  const headerRead = profile.indexOf("req.headers['x-proxy-target-url']");
  const guardCall = profile.indexOf('rejectUnsafeOutboundUrl(targetUrl)');
  assert.ok(headerRead > -1, 'header 读取点应存在');
  assert.ok(guardCall > headerRead, '守卫必须在读取 header 之后、发起请求之前');
});

test('both outbound paths share one guard implementation', () => {
  const resolver = readFileSync(
    path.join(ROOT_DIR, 'services', 'api', 'routes', 'user', 'shared', 'profileRouteResolver.js'),
    'utf8'
  );
  const profile = readFileSync(
    path.join(ROOT_DIR, 'services', 'api', 'routes', 'user', 'profile.js'),
    'utf8'
  );

  assert.match(resolver, /require\('\.\/outboundUrlGuard'\)/, 'baseUrl 路径应引用共享守卫');
  assert.match(profile, /require\('\.\/shared\/outboundUrlGuard'\)/, 'header 路径应引用共享守卫');
});
