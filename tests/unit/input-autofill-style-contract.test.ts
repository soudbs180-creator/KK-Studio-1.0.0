import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

test("global inputs neutralize browser autofill and selection color overlays", () => {
  const cssSource = readSource("src/index.css");
  const authCssSource = readSource("src/components/auth/LoginScreen.css");
  const adminCssSource = readSource("apps/admin/src/styles/admin.css");

  assert.match(
    cssSource,
    /input:-webkit-autofill,[\s\S]*textarea:-webkit-autofill,[\s\S]*select:-webkit-autofill/,
  );
  assert.match(
    cssSource,
    /-webkit-text-fill-color:\s*var\(--input-autofill-text,\s*var\(--text-primary\)\);/,
  );
  assert.match(
    cssSource,
    /box-shadow:\s*0 0 0 1000px var\(--input-autofill-bg,\s*var\(--bg-input\)\) inset !important;/,
  );
  assert.match(cssSource, /::selection\s*\{/);
  assert.match(cssSource, /background:\s*var\(--input-selection-bg,/);

  assert.match(authCssSource, /\.auth-input-wrap\s*\{[\s\S]*--input-autofill-bg:/);
  assert.match(authCssSource, /\.auth-page--light \.auth-input-wrap\s*\{[\s\S]*--input-autofill-bg:/);

  assert.match(adminCssSource, /\.admin-login-input\s*\{[\s\S]*--input-autofill-bg:/);
  assert.match(adminCssSource, /\.admin-login-input input:-webkit-autofill/);
});
