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

test('LoginScreen stays parseable and exposes google plus compact auxiliary auth actions', () => {
  const source = readSource(LOGIN_SCREEN_PATH);
  const sourceFile = ts.createSourceFile(
    LOGIN_SCREEN_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  assert.deepEqual(sourceFile.parseDiagnostics, []);
  assert.match(source, /import \{ useAdminRole \} from '\.\.\/\.\.\/hooks\/useAdminRole';/);
  assert.match(source, /import \{ startGoogleSignIn \} from '\.\.\/\.\.\/services\/auth\/googleAuth\.ts';/);
  assert.match(source, /const handleGoogleLogin = async \(\) => \{/);
  assert.match(source, /Continue with Google/);
  assert.match(source, /className="auth-aux-actions"/);
  assert.match(source, /Temporary account/);
  assert.match(source, /Admin sign-in/);
  assert.match(source, /Sign in with an administrator account first\./);
  assert.match(source, /Current account is not an administrator\./);
});

test('LoginScreen styles keep temporary and admin entry points compact and grouped', () => {
  const source = readSource(LOGIN_SCREEN_CSS_PATH);

  assert.match(source, /\.auth-aux-actions \{/);
  assert.match(source, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(source, /\.auth-btn-compact \{/);
  assert.match(source, /min-height:\s*40px;/);
  assert.match(source, /font-size:\s*13px;/);
});
