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

test("encoding check blocks visible mojibake text in release UI surfaces", () => {
  const source = readFileSync(path.join(ROOT_DIR, "scripts", "ci", "check-encoding.js"), "utf-8");
  const generationRuntime = readFileSync(path.join(ROOT_DIR, "apps/web/src", "app", "useGenerationRuntime.ts"), "utf-8");
  const pendingNode = readFileSync(path.join(ROOT_DIR, "apps/web/src", "components", "canvas", "PendingNode.tsx"), "utf-8");

  assert.match(source, /suspiciousMojibakePatterns/);
  assert.match(source, /\\u00e9\[\\u00a0-\\u00bf\]/i);
  assert.match(source, /\\u9365/);
  assert.doesNotMatch(generationRuntime, /\u00c3\u00a9\u00c2\u00a1\u00c2\u00b5|\u00c3\u00a6\u00c5\u201c\u00c2\u00aa|\u00c3\u00a5\u00c2\u008d\u00e2\u20ac\u00a2|\u00c3\u00a3\u00e2\u201a\u00ac|\u00c3\u00af\u00c2\u00bc|\u00c3\u201a/);
  assert.doesNotMatch(pendingNode, /\u9365\u60e7\u511a|\u59dd\uff45\u6e6a|\u9351\u55d7|\ue62c/);
  assert.doesNotMatch(pendingNode, />Generating x\{parallelCount\}</);
  assert.doesNotMatch(pendingNode, />\s*Generating #\{i \+ 1\}\s*</);
  assert.doesNotMatch(pendingNode, /alt="Reference"/);
  assert.match(pendingNode, />生成中 x\{parallelCount\}</);
  assert.match(pendingNode, />\s*生成队列 #\{i \+ 1\}\s*</);
  assert.match(pendingNode, /alt="参考图"/);
});
