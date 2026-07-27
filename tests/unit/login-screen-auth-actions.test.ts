import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const ROOT_DIR = process.cwd();
const LOGIN_SCREEN_PATH = 'apps/web/src/components/auth/LoginScreen.tsx';
const LOGIN_SCREEN_CSS_PATH = 'apps/web/src/components/auth/LoginScreen.css';
const INDEX_HTML_PATH = 'apps/web/index.html';
const TURNSTILE_WIDGET_PATH = 'apps/web/src/components/auth/TurnstileWidget.tsx';



test('LoginScreen stays parseable and keeps the server-backed sign-in actions compact', () => {
  const source = readSource(LOGIN_SCREEN_PATH);
  const sourceFile = ts.createSourceFile(
    LOGIN_SCREEN_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  assert.deepEqual((sourceFile as any).parseDiagnostics, []);
  assert.match(source, /const \{ loginAsTempUser \} = useAuth\(\);/);
  assert.match(source, /const \{ startGoogleSignIn \} = await import\('\.\.\/\.\.\/services\/auth\/googleAuth\.ts'\);/);
  assert.match(source, /const \{ startWechatLogin \} = await import\('\.\.\/\.\.\/services\/auth\/wechatAuth\.ts'\);/);
  assert.doesNotMatch(source, /import \{ startGoogleSignIn \} from '\.\.\/\.\.\/services\/auth\/googleAuth\.ts';/);
  assert.doesNotMatch(source, /import \{ startWechatLogin \} from '\.\.\/\.\.\/services\/auth\/wechatAuth\.ts';/);
  assert.match(source, /const handleGoogleLogin = async \(\) => \{/);
  assert.match(source, /const handleWechatLogin = async \(\) => \{/);
  assert.match(source, /const authStart = await startWechatLogin\(\);/);
  assert.match(source, /onClick=\{handleWechatLogin\}/);
  assert.match(source, /const handleTempUserEntry = async \(\) => \{/);
  assert.match(source, /await loginAsTempUser\(\);/);
  assert.match(source, /Continue with Google/);
  assert.match(source, /className="auth-aux-actions"/);
  assert.match(source, /Temporary local access/);
  assert.match(source, /Admin sign-in/);
  assert.match(source, /注册请求已提交，后端认证接口就绪后可继续完成验证。/);
  assert.match(source, /\u8bf7\u5b8c\u6210 Cloudflare \u5b89\u5168\u9a8c\u8bc1\u540e\u518d\u767b\u5f55\u3002/);
  assert.match(source, /密码长度至少 8 位。/);
  assert.match(source, /Password must be at least 8 characters\./);
  assert.match(source, /minLength=\{8\}/);
  assert.match(source, /const handleConfirmPasswordChange = useCallback\(\(event: React\.ChangeEvent<HTMLInputElement>\) => \{/);
  assert.match(source, /setFieldErrors\(validateFields\(view, email, password, nextConfirmPassword, language\)\);/);
  assert.doesNotMatch(source, /setConfirmPassword\(event\.target\.value\);\s*setFieldErrors\(localErrors\);/);
  assert.doesNotMatch(source, /\?{3,}/);
  assert.doesNotMatch(source, /\u00e5\u00a8\u2030\u00e3\u201e\u00a5\u00e5\u201d\u00bd/);
  assert.doesNotMatch(source, /\u00e7\u2019\u2021\u00e5\u00b3\u00b0\u00e5\u017d\u203a/);
  assert.doesNotMatch(source, /if \(!user\)/);
  assert.doesNotMatch(source, /if \(checkingAdmin\)/);
  assert.doesNotMatch(source, /if \(!isAdmin\)/);
});

test('LoginScreen styles keep temporary and admin entry points compact and grouped', () => {
  const source = readSource(LOGIN_SCREEN_CSS_PATH);

  assert.match(source, /--auth-system-bg:\s*var\(--app-startup-bg\);/);
  assert.match(source, /--auth-system-panel-bg:\s*var\(--app-startup-panel-bg\);/);
  assert.match(source, /--auth-system-title:\s*var\(--app-startup-title\);/);
  assert.match(source, /--auth-system-motion:\s*calc\(var\(--kk-motion-standard\)\s*\*\s*var\(--kk-ui-motion-scale\)\);/);
  assert.match(source, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(source, /body\.auth-screen-active\.auth-screen-active--dark[\s\S]*background:\s*var\(--auth-system-bg\) !important;/);
  assert.doesNotMatch(source, /background:\s*#07111f !important;/);
  assert.doesNotMatch(source, /background:\s*#eef4ff !important;/);
  assert.match(source, /\.auth-aux-actions \{/);
  assert.match(source, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(source, /\.auth-btn-compact \{/);
  assert.match(source, /min-height:\s*40px;/);
  assert.match(source, /font-size:\s*13px;/);
});

test('LoginScreen keeps Turnstile status visible when the widget cannot render', () => {
  const source = readSource(LOGIN_SCREEN_PATH);

  assert.match(source, /const turnstileDisabledByRuntime = !TURNSTILE_ENABLED;/);
  assert.match(source, /const showTurnstileBlock = turnstileAvailable \|\| turnstileMissingSiteKey \|\| turnstileDisabledByRuntime;/);
  assert.match(source, /const \[turnstileWidgetStatus, setTurnstileWidgetStatus\] = useState<TurnstileStatus>\('idle'\);/);
  assert.match(source, /const turnstileWidgetFailed = turnstileAvailable && !turnstileToken && turnstileWidgetStatus === 'error';/);
  assert.match(source, /const turnstileAwaitingVerification = turnstileAvailable && !turnstileToken && turnstileWidgetStatus === 'rendered';/);
  assert.match(source, /turnstileWidgetFailed \|\| !turnstileAvailable \? 'is-error' : 'is-pending'/);
  assert.match(source, /turnstileWidgetFailed\s*\?\s*t\('\u9a8c\u8bc1\u5f02\u5e38', 'Error'\)/);
  assert.match(source, /onStatusChange=\{handleTurnstileStatusChange\}/);
  assert.match(source, /请完成 Cloudflare 安全验证后再登录。/);
  assert.match(source, /turnstileMissingSiteKey\s*\?\s*getTurnstileMissingSiteKeyMessage\(language\)\s*:\s*getTurnstileDisabledMessage\(language\)/);
});

test('LoginScreen styles do not hide the Turnstile module label or hint', () => {
  const source = readSource(LOGIN_SCREEN_CSS_PATH);

  assert.doesNotMatch(source, /\.auth-turnstile-head,\s*\.auth-turnstile-help\s*\{\s*display:\s*none;\s*\}/);
  assert.match(source, /\.auth-turnstile-head \{[\s\S]*display:\s*flex;/);
  assert.match(source, /\.auth-turnstile-help \{[\s\S]*display:\s*block;/);
});

test('Turnstile only connects to Cloudflare when the auth widget requests it', () => {
  const htmlSource = readSource(INDEX_HTML_PATH);
  const widgetSource = readSource(TURNSTILE_WIDGET_PATH);

  assert.doesNotMatch(htmlSource, /challenges\.cloudflare\.com/);
  assert.doesNotMatch(htmlSource, /data-turnstile-script/);
  assert.match(widgetSource, /const TURNSTILE_SCRIPT_URL = 'https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit';/);
  assert.match(widgetSource, /function ensureTurnstileConnectionHints\(\): void \{/);
  assert.match(widgetSource, /dnsPrefetch\.rel = 'dns-prefetch';/);
  assert.match(widgetSource, /preconnect\.rel = 'preconnect';/);
  assert.match(widgetSource, /ensureTurnstileConnectionHints\(\);\s*const script = document\.createElement\('script'\);/);
});
