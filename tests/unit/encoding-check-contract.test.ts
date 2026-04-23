import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

test("encoding check scans root docs and env examples with readable messaging", () => {
  const source = readFileSync(path.join(ROOT_DIR, "scripts", "ci", "check-encoding.js"), "utf-8");
  const fixerSource = readFileSync(path.join(ROOT_DIR, "scripts", "ci", "fix-garbled-chars.cjs"), "utf-8");

  assert.match(source, /new TextDecoder\("utf-8", \{ fatal: true \}\)/);
  assert.match(source, /function decodeUtf8OrThrow\(filePath\)/);
  assert.match(source, /Found invalid UTF-8 bytes/);
  assert.match(source, /"README\.md"/);
  assert.match(source, /"PROJECT_ROOT_GUIDE\.md"/);
  assert.match(source, /"\.env\.example"/);
  assert.match(source, /"\.agent"/);
  assert.match(source, /path\.join\("apps", "api", "\.env\.local\.example"\)/);
  assert.match(source, /Found suspicious mojibake text/);
  assert.match(source, /Found traditional Chinese characters/);
  assert.match(source, /traditionalOnlyChars/);
  assert.match(source, /Encoding check passed/);
  assert.match(source, /path\.resolve\("scripts", "ci", "fix-garbled-chars\.cjs"\)/);
  assert.match(source, /const suspiciousFragments = \[/);
  assert.match(source, /const suspiciousCharSet = new Set\("/);
  assert.match(fixerSource, /require\('zlib'\)/);
  assert.match(fixerSource, /gunzipSync/);
  assert.match(fixerSource, /GARBLED_MAP_BLOB_BASE64/);
  assert.match(fixerSource, /loadGarbledMap/);
  assert.doesNotMatch(fixerSource, /const garbledMap = \{/);
});
