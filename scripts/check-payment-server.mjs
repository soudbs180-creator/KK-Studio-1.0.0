import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const paymentServerRoot = path.join(root, "payment-server");
const excludedSegments = new Set(["node_modules"]);
const supportedExtensions = new Set([".js", ".cjs", ".mjs"]);

function collectJavaScriptFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  const collected = [];

  if (!fs.existsSync(absoluteDir)) {
    return collected;
  }

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (excludedSegments.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectJavaScriptFiles(path.relative(root, absolutePath)));
      continue;
    }

    if (supportedExtensions.has(path.extname(entry.name))) {
      collected.push(absolutePath);
    }
  }

  return collected.sort();
}

if (!fs.existsSync(paymentServerRoot)) {
  console.log("[payment-server:check] payment-server/ is not present, skipping.");
  process.exit(0);
}

const files = collectJavaScriptFiles("payment-server");
if (files.length === 0) {
  console.log("[payment-server:check] no JavaScript files found under payment-server/.");
  process.exit(0);
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: root,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `[payment-server:check] node --check failed for ${file}\n`);
    process.exit(result.status || 1);
  }
}

console.log(`[payment-server:check] syntax check passed for ${files.length} files.`);
