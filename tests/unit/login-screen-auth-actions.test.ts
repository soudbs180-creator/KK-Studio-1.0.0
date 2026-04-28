import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const ROOT_DIR = process.cwd();
const LOGIN_SCREEN_PATH = 'src/components/auth/LoginScreen.tsx';
const LOGIN_SCREEN_CSS_PATH = 'src/components/auth/LoginScreen.css';

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('LoginScreen stays parseable and keeps the server-backed sign-in actions compact', () => {
  const source = readSource(LOGIN_SCREEN_PATH);
  const sourceFile = ts.createSourceFile(
    LOGIN_SCREEN_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  assert.deepEqual(sourceFile.parseDiagnostics, []);
  assert.match(source, /const \{ loginAsTempUser \} = useAuth\(\);/);
  assert.match(source, /import \{ startGoogleSignIn \} from '\.\.\/\.\.\/services\/auth\/googleAuth\.ts';/);
  assert.match(source, /const handleGoogleLogin = async \(\) => \{/);
  assert.match(source, /const handleTempUserEntry = async \(\) => \{/);
  assert.match(source, /await loginAsTempUser\(\);/);
  assert.match(source, /Continue with Google/);
  assert.match(source, /className="auth-aux-actions"/);
  assert.match(source, /Temporary local access/);
  assert.match(source, /Admin sign-in/);
  assert.match(source, /注册请求已提交，后端认证接口就绪后可继续完成验证。/);
  assert.match(source, /当前请求需要先完成人机验证，验证通过后再提交。/);
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

  assert.match(source, /\.auth-aux-actions \{/);
  assert.match(source, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(source, /\.auth-btn-compact \{/);
  assert.match(source, /min-height:\s*40px;/);
  assert.match(source, /font-size:\s*13px;/);
});
