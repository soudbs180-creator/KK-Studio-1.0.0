import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["src", "apps", "packages", "server", "api", "billing", "payment-server", "netlify"];
const includeExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".cjs", ".mjs"]);
const failures = [];

const storageAllowlist = new Set([
  "src/services/api/authAccessToken.ts",
  "packages/api-client/src/client.ts",
  "packages/shared/src/contracts/client/kk-api-client.ts",
]);

const publicViteSensitiveEnvAllowlist = new Set([
  "VITE_TURNSTILE_SITE_KEY",
]);

function fail(message) {
  failures.push(`[security:check] ${message}`);
}

function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      files.push(...walk(relativePath));
      continue;
    }
    if (includeExtensions.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }
  return files;
}

function lineLooksLikeSensitiveLog(line) {
  if (!/console\.(log|warn|error|info)/.test(line)) {
    return false;
  }

  if (!/(access[_-]?token|refresh[_-]?token|secret|api[_-]?key|authorization|bearer)/i.test(line)) {
    return false;
  }

  if (/maxOutputTokens/i.test(line)) {
    return false;
  }

  const hasDynamicLogPayload = /`[^`]*\$\{|,\s*[A-Za-z_$]/.test(line);
  return hasDynamicLogPayload;
}

function collectConsoleBlocks(lines) {
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/console\.(log|warn|error|info)\s*\(/.test(line)) {
      continue;
    }

    let block = line;
    let endIndex = index;

    while (endIndex + 1 < lines.length && !/\)\s*;?\s*$/.test(lines[endIndex])) {
      endIndex += 1;
      block += `\n${lines[endIndex]}`;
    }

    blocks.push({
      lineNumber: index + 1,
      block,
    });

    index = endIndex;
  }

  return blocks;
}

const rawSensitivePayloadPatterns = [
  /\bpassback_params\b/i,
  /(?:^|[,(])\s*keyData\b(?!\s*\.)/,
  /(?:^|[,(])\s*formKey\b(?!\s*\.)/,
  /(?:^|[,(])\s*postData\b(?!\s*\.)/,
  /:\s*keyData\b(?!\s*\.)/,
  /:\s*formKey\b(?!\s*\.)/,
  /:\s*postData\b(?!\s*\.)/,
  /[{,]\s*keyData\s*(?:[,}])/,
  /[{,]\s*formKey\s*(?:[,}])/,
  /[{,]\s*postData\s*(?:[,}])/,
];

function blockLooksLikeSensitiveLog(block) {
  if (!/console\.(log|warn|error|info)\s*\(/.test(block)) {
    return false;
  }

  if (/maxOutputTokens/i.test(block)) {
    return false;
  }

  const hasRawSensitivePayload = rawSensitivePayloadPatterns.some((pattern) => pattern.test(block));
  if (hasRawSensitivePayload) {
    return true;
  }

  const hasSensitiveIdentifier =
    /(access[_-]?token|refresh[_-]?token|secret|api[_-]?key|authorization|bearer)/i.test(block);
  if (!hasSensitiveIdentifier) {
    return false;
  }

  const hasDynamicPayload =
    /`[^`]*\$\{|,\s*[A-Za-z_$[{]/.test(block)
    || /\{\s*[A-Za-z_$]/.test(block.split(/\r?\n/).slice(1).join("\n"));

  return hasDynamicPayload;
}

for (const file of sourceRoots.flatMap((dir) => walk(dir))) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const lines = source.split(/\r?\n/);
  const consoleBlocks = collectConsoleBlocks(lines);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (
      /(localStorage|sessionStorage)\.setItem/.test(line)
      && /(token|secret|api[_-]?key|auth)/i.test(line)
      && !storageAllowlist.has(file)
    ) {
      fail(`${file}:${lineNumber} writes a sensitive-looking value into browser storage without an allowlist entry`);
    }

    if (lineLooksLikeSensitiveLog(line)) {
      fail(`${file}:${lineNumber} logs a sensitive-looking identifier without an allowlist entry`);
    }

    for (const match of line.matchAll(/\bVITE_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)[A-Z0-9_]*\b/g)) {
      const envName = match[0];
      if (!publicViteSensitiveEnvAllowlist.has(envName)) {
        fail(`${file}:${lineNumber} references ${envName}; VITE_* key/secret/token names are exposed to the browser and require an explicit public allowlist entry`);
      }
    }
  }

  for (const consoleBlock of consoleBlocks) {
    if (blockLooksLikeSensitiveLog(consoleBlock.block)) {
      fail(`${file}:${consoleBlock.lineNumber} logs a sensitive-looking payload without an allowlist entry`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("[security:check] Sensitive storage and logging boundaries passed.");
