import fs from "fs";
import path from "path";

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const scanRoots = [
  "src",
  "apps",
  "api",
  "billing",
  "config",
  "docs",
  ".agent",
  "packages",
  "payment-server",
  "scripts",
  "server",
  "supabase",
  "tests",
  "vite.config.ts",
  "vercel.json",
  "README.md",
  "PROJECT_ROOT_GUIDE.md",
  ".env.example",
  path.join("apps", "api", ".env.local.example"),
];

const scanExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".html",
  ".css",
  ".yaml",
  ".yml",
]);

const broadMojibakePatternRoots = new Set([
  "src",
  "apps",
  "api",
  "billing",
  "packages",
  "payment-server",
  "server",
  "supabase",
]);
const suspiciousFragments = [
  "\u93C4\uE219\u7AF4\u5A06",
  "\u9359\u6220\u5E47",
  "\u7F02\u682B\u721C",
  "\u7487\u5CF0",
  "\u6DC7\u6FC6\u74E8",
  "\u93C6\u509B\u6902",
  "\u59AB\u20AC\u5A34",
  "\u8930\u64B3\u58A0",
  "\u7039\u6A3B\u67DF",
  "\u7ED7\uE0FF\u7B01\u93C2",
  "\u93BA\u30E5\u5F5B",
  "\u9352\u950B\u67CA",
  "\u5A34\u5FDA\uE74D\u9363",
  "\u9422\u3124\u7C2C\u93B5\u80EF\u6D47",
  "SUPABASE_SERVICE_ROLE_KEY=\u6D63\u72B5\u6B91",
];
const suspiciousCharSet = new Set("\u9359\u95C2\u59AB\u7487\u6DC7\u93C2\u8930\u7F02\u95B9\u93C6\u95B2\u68F0\u6E1A\u6D98\u7C32\u9350\u5A34\u7039\u95AB\u7ED7\u9422\u6D63");
const suspiciousMojibakePatterns = [
  /[\u00c3\u00c2]\S{0,3}[\u00a0-\u00bf]/u,
  /\u00e9[\u00a0-\u00bf]/u,
  /[\u00e5\u00e6\u00e7\u00e8\u00e4][\u0080-\u00bf\u2018-\u2026]/u,
  /[\u00e3\u00ef][\u0080-\u00bf\u201a-\u2026]/u,
  /\u00e2[\u0080-\u00bf\u0153\u20ac\u2122]/u,
  /\u00f0\u0178/u,
  /[\u9365\u60e7\u511a\u59dd\u6e6a\u9351\u55d7\ue62c\u9435\u74a7]/u,
];
const traditionalOnlyChars = new Set(["這", "個", "們", "為", "與", "會", "體", "點", "對", "於", "裡", "發", "說", "請", "將", "後", "臺", "門", "風", "務", "應", "變", "數", "圖", "層", "審", "寫", "則", "誤", "檢", "碼", "邏", "輯", "網"]);
const skipDirectories = new Set([
  "node_modules",
  "dist",
  ".git",
  ".npm-cache",
  "coverage",
  ".agent",
  ".agents",
  ".kk-local",
  ".tmp-playwright",
  "release",
  "workspace",
]);
const ignoreFiles = new Set([
  path.resolve(process.argv[1]),
  path.resolve("scripts", "ci", "fix-garbled-chars.cjs"),
]);
const invalidUtf8Issues = [];
const mojibakeIssues = [];
const traditionalIssues = [];

function decodeUtf8OrThrow(filePath) {
  const raw = fs.readFileSync(filePath);
  return utf8Decoder.decode(raw);
}

function shouldScan(filePath) {
  if (ignoreFiles.has(path.resolve(filePath))) {
    return false;
  }

  return scanExtensions.has(path.extname(filePath)) || path.basename(filePath).startsWith(".env");
}

function countSuspiciousChars(text) {
  let count = 0;
  for (const char of text) {
    if (suspiciousCharSet.has(char)) {
      count += 1;
    }
  }
  return count;
}

function shouldApplyBroadMojibakePatterns(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const [root] = relativePath.split(path.sep);
  return broadMojibakePatternRoots.has(root);
}

function hasSuspiciousText(text, filePath) {
  if (
    text.startsWith("//")
    || text.startsWith("/*")
    || text.startsWith("{/*")
    || text.startsWith("<!--")
    || text.startsWith("*")
    || text.startsWith("*/")
  ) {
    return false;
  }

  if (text.includes("pick(") || text.includes("suspiciousLocaleCharSet")) {
    return false;
  }

  if (suspiciousFragments.some((fragment) => text.includes(fragment))) {
    return true;
  }

  if (shouldApplyBroadMojibakePatterns(filePath) && suspiciousMojibakePatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  const suspiciousCharCount = countSuspiciousChars(text);
  if (suspiciousCharCount >= 2) {
    return true;
  }

  if (text.includes("?") && suspiciousCharCount >= 1 && /[\u4e00-\u9fff]/u.test(text)) {
    return true;
  }

  return false;
}

function hasTraditionalCharacter(text) {
  if (
    text.startsWith("//")
    || text.startsWith("/*")
    || text.startsWith("*")
    || text.startsWith("*/")
  ) {
    return false;
  }

  for (const char of text) {
    if (traditionalOnlyChars.has(char)) {
      return true;
    }
  }

  return false;
}

function walk(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const resolvedPath = path.resolve(targetPath);
  if (ignoreFiles.has(resolvedPath)) {
    return;
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(resolvedPath, { withFileTypes: true })) {
      if (skipDirectories.has(entry.name)) {
        continue;
      }

      walk(path.join(resolvedPath, entry.name));
    }
    return;
  }

  if (!shouldScan(resolvedPath)) {
    return;
  }

  let content;
  try {
    content = decodeUtf8OrThrow(resolvedPath);
  } catch (error) {
    invalidUtf8Issues.push(`${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    if (hasSuspiciousText(trimmed, resolvedPath)) {
      mojibakeIssues.push(`${resolvedPath}:${index + 1}: ${trimmed}`);
    }

    if (hasTraditionalCharacter(trimmed)) {
      traditionalIssues.push(`${resolvedPath}:${index + 1}: ${trimmed}`);
    }
  });
}

for (const target of scanRoots) {
  walk(path.resolve(target));
}

if (mojibakeIssues.length > 0) {
  console.error("Found suspicious mojibake text. Please review the following locations:");
  for (const issue of mojibakeIssues) {
    console.error(issue);
  }
  process.exit(1);
}

if (invalidUtf8Issues.length > 0) {
  console.error("Found invalid UTF-8 bytes. Please repair the affected files before continuing:");
  for (const issue of invalidUtf8Issues) {
    console.error(issue);
  }
  process.exit(1);
}

if (traditionalIssues.length > 0) {
  console.error("Found traditional Chinese characters in tracked source/docs. Please convert them to simplified Chinese:");
  for (const issue of traditionalIssues) {
    console.error(issue);
  }
  process.exit(1);
}

console.log("Encoding check passed: no suspicious mojibake text or traditional Chinese characters found.");
