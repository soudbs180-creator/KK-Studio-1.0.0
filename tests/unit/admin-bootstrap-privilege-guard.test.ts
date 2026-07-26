import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readServerSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, 'services', 'api', relativePath), 'utf8');
}

// ---------------------------------------------------------------------------
// 回归守护：按邮箱自动册封管理员的引导逻辑一旦带上硬编码默认邮箱，
// 就构成完整的自助提权链——注册接口不校验邮箱所有权，任何人抢注该邮箱后
// 调用一次会话/档案接口即被写入 admin_level=1，进而可读取全部上游 API Key 明文、
// 任意增发积分、册封同伙。这些断言把该缺陷钉死。
// ---------------------------------------------------------------------------

const BOOTSTRAP_SOURCES = [
  'routes/user/profile.js',
  'routes/user/auth.js',
];

test('admin bootstrap email never falls back to a hardcoded address', () => {
  for (const relativePath of BOOTSTRAP_SOURCES) {
    const source = readServerSource(relativePath);
    const declaration = source.match(/const INITIAL_ADMIN_EMAIL\s*=\s*(.+)/);

    assert.ok(declaration, `${relativePath} 应声明 INITIAL_ADMIN_EMAIL`);
    assert.doesNotMatch(
      declaration![1],
      /\|\|\s*['"][^'"]*@/,
      `${relativePath} 的 INITIAL_ADMIN_EMAIL 不得回退到硬编码邮箱；未配置时必须为空并跳过引导`
    );
  }
});

test('admin promotion is gated on an explicitly configured email', () => {
  const profileSource = readServerSource('routes/user/profile.js');
  const authSource = readServerSource('routes/user/auth.js');

  // auth.js 用具名守卫函数；profile.js 受行数门禁约束，采用等价的行内守卫。
  // 两者的共同契约：未配置 ADMIN_INITIAL_EMAIL 时必须为假。
  assert.match(authSource, /function shouldBootstrapAdmin\(/, 'auth.js 应定义 shouldBootstrapAdmin');
  assert.match(authSource, /Boolean\(INITIAL_ADMIN_EMAIL\)/, 'auth.js 的守卫必须在未配置时返回 false');
  assert.match(
    profileSource,
    /if \(INITIAL_ADMIN_EMAIL &&/,
    'profile.js 的提权分支必须以「已显式配置」为前置条件'
  );

  for (const [label, source] of [['profile.js', profileSource], ['auth.js', authSource]] as const) {
    const bareComparisons = source.match(/user\.email === INITIAL_ADMIN_EMAIL/g) || [];
    assert.equal(bareComparisons.length, 0, `${label} 不得再用裸相等比较决定提权`);
  }
});

test('every admin_level write is guarded, including sites added later', () => {
  for (const relativePath of BOOTSTRAP_SOURCES) {
    const source = readServerSource(relativePath);
    const writes = source.match(/SET admin_level = 1/g) || [];
    if (writes.length === 0) continue;

    // 守卫出现次数必须覆盖每一处写入（具名调用或行内前置条件均计入）。
    // 这条断言曾实际抓出 profile.js 中一处被遗漏的提权点。
    const guards = (source.match(/shouldBootstrapAdmin\(user\.email\)/g) || []).length
      + (source.match(/if \(INITIAL_ADMIN_EMAIL &&/g) || []).length;

    assert.ok(
      guards >= writes.length,
      `${relativePath} 有 ${writes.length} 处 admin_level 写入，但只有 ${guards} 处守卫`
    );
  }
});

test('local single-machine default email is separated from the admin bootstrap check', () => {
  const authSource = readServerSource('routes/user/auth.js');

  // 本地档案仍需要一个兜底邮箱，但它不得再参与提权判定。
  assert.match(authSource, /const LOCAL_DEFAULT_EMAIL\s*=/);
  assert.doesNotMatch(
    authSource,
    /shouldBootstrapAdmin[\s\S]{0,200}LOCAL_DEFAULT_EMAIL/,
    '本地默认邮箱不得进入提权判定'
  );
});
