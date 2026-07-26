import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const ROOT_DIR = process.cwd();

// ---------------------------------------------------------------------------
// 1) 免积分通道必须由服务端解析的 connection 决定，不能采信客户端声明。
//
// 缺陷原状：quoteEngine 用 `connectionRoute?.channel || request.preferredChannel`，
// 客户端只要传 preferredChannel='byok' 且不带 connectionId，就绕过积分计价与余额校验，
// 最终 adapter 回落到平台自有 *_API_KEY 完成生成 —— 零扣费白嫖且不留 ledger 记录。
// ---------------------------------------------------------------------------

const LIFECYCLE = readFileSync(
  path.join(ROOT_DIR, 'services', 'api', 'lib', 'generation-v3', 'jobLifecycle.js'),
  'utf8'
);

test('free channels are refused at execution time when no own credential resolved', () => {
  // 守卫必须拦在执行阶段：报价不产生成本，legacy 路径仍需能正常报价；
  // 真正的白嫖发生在提交执行、adapter 回落到平台 *_API_KEY 时。
  assert.match(LIFECYCLE, /function assertFreeChannelHasOwnCredential\(/);
  assert.match(
    LIFECYCLE,
    /FREE_CHANNELS = new Set\(\['byok', 'cloud-key', 'web-membership'\]\)/,
    '三个免积分通道都必须纳入校验'
  );
  assert.match(LIFECYCLE, /CONNECTION_CREDENTIAL_REQUIRED/);

  // 必须在解析出 auth 之后立即校验，且在返回给调用方之前。
  const resolveIdx = LIFECYCLE.indexOf('const auth = await resolveAuth(');
  const guardIdx = LIFECYCLE.indexOf('assertFreeChannelHasOwnCredential(quote.channel, auth)');
  assert.ok(resolveIdx > -1 && guardIdx > resolveIdx, '守卫必须在 auth 解析之后执行');
});

test('platform-credits is deliberately excluded from the credential requirement', () => {
  // platform-credits 同样没有 connectionId，但它走积分扣减，
  // 依赖平台 Key 属预期行为 —— 若误纳入校验会打断付费主链路。
  assert.doesNotMatch(
    LIFECYCLE,
    /FREE_CHANNELS[\s\S]{0,120}platform-credits/,
    'platform-credits 不得被纳入免积分通道集合'
  );
});

test('quote stage keeps its legacy semantics so quoting itself is not broken', () => {
  const source = readFileSync(
    path.join(ROOT_DIR, 'services', 'api', 'lib', 'generation-v3', 'quoteEngine.js'),
    'utf8'
  );
  // 报价阶段保留 preferredChannel 兜底，legacy 路径与 setup-required 语义不变。
  assert.match(source, /connectionRoute\?\.channel \|\| request\.preferredChannel/);
});

// ---------------------------------------------------------------------------
// 2) 便携版自更新的完整性校验必须强制执行。
//
// 缺陷原状：`if (-not [string]::IsNullOrWhiteSpace($remoteManifest.sha256))` ——
// 攻击者在清单里删掉 sha256 即可跳过整个校验分支；随后压缩包被解包覆盖到
// $ReleaseRoot（含 runtime\node.exe 与启动脚本），用户下次启动即执行投放的可执行文件。
// ---------------------------------------------------------------------------

const UPDATER = readFileSync(
  path.join(ROOT_DIR, 'scripts', 'release', 'portable-self-update.ps1'),
  'utf8'
);

test('the sha256 integrity check is mandatory, not conditional on the manifest', () => {
  assert.doesNotMatch(
    UPDATER,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$remoteManifest\.sha256\)\)/,
    'sha256 校验不得以「清单里有才校验」为条件（fail-open）'
  );
  assert.match(
    UPDATER,
    /\$expectedHash -notmatch '\^\[0-9a-f\]\{64\}\$'/,
    '缺少或格式非法的 sha256 必须直接中止安装'
  );
  assert.match(UPDATER, /Refusing to install/);
});

test('the update source is restricted to https and the download must share the manifest host', () => {
  assert.match(UPDATER, /\$manifestUri\.Scheme -ne 'https'/, '清单必须经 https 获取');
  assert.match(UPDATER, /\$downloadUri\.Scheme -ne 'https'/, '下载地址必须是 https');
  assert.match(
    UPDATER,
    /\$downloadUri\.Host -ne \$manifestUri\.Host/,
    '下载地址必须与清单同源，防止被篡改的清单指向第三方载荷'
  );
});

test('the publisher still emits a sha256, so mandatory verification breaks no legitimate release', () => {
  const publisher = readFileSync(
    path.join(ROOT_DIR, 'scripts', 'release', 'publish-portable-release.mjs'),
    'utf8'
  );
  assert.match(
    publisher,
    /sha256:\s*createHash\("sha256"\)/,
    '发布器必须始终生成 sha256；若这条不成立，强制校验会阻断正常发布'
  );
});
