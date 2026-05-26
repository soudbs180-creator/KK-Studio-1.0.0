// scripts/check-server.mjs
// 职责：在 CI/CD 中对迁移合并后的 server/ 目录下的所有 JavaScript 源码进行静态语法校验。
// 遵守规范：中文注释。

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

const root = process.cwd();
const serverRoot = path.join(root, "server");
const excludedSegments = new Set(["node_modules"]);
const supportedExtensions = new Set([".js", ".cjs", ".mjs"]);

function checkWithVm(file) {
  const source = fs.readFileSync(file, "utf8");
  new vm.Script(source, { filename: file });
}

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

if (!fs.existsSync(serverRoot)) {
  console.log("[server:check] server/ is not present, skipping.");
  process.exit(0);
}

const files = collectJavaScriptFiles("server");
if (files.length === 0) {
  console.log("[server:check] no JavaScript files found under server/.");
  process.exit(0);
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: root,
    encoding: "utf8",
  });

  if (result.error?.code === "EPERM") {
    try {
      checkWithVm(file);
      continue;
    } catch (error) {
      process.stderr.write(String(error?.stack || error?.message || error));
      process.exit(1);
    }
  }

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `[server:check] node --check failed for ${file}\n`);
    process.exit(result.status || 1);
  }
}

console.log(`[server:check] syntax check passed for ${files.length} files.`);
