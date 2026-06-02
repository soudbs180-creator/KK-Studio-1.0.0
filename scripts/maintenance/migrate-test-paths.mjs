// scripts/maintenance/migrate-test-paths.mjs
// 职责：物理替换测试用例中所有硬编码的 Legacy 路径（旧 src/、packages/contracts/ 等）。
// 所有注释均使用中文。

import fs from 'node:fs';
import path from 'node:path';

const testDir = 'c:/Users/Administrator/Downloads/KK-Studio-1.0.0/tests';

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      callback(fullPath);
    }
  }
}

let modifiedFiles = 0;

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. 替换所有的 src/，要求其前面不是 apps/web/、apps/mobile/ 或 packages/shared/
  content = content.replace(/(?<!apps\/web\/|apps\/mobile\/|packages\/shared\/)src\//g, "apps/web/src/");

  // 2. 替换 index.html 和 PROJECT_ROOT_GUIDE.md
  content = content.replace(/(?<!apps\/web\/)index\.html/g, "apps/web/index.html");
  content = content.replace(/(?<!docs\/)PROJECT_ROOT_GUIDE\.md/g, "docs/PROJECT_ROOT_GUIDE.md");

  // 3. 替换 packages/contracts/src/ 为 packages/shared/src/contracts/
  content = content.replace(/packages\/contracts\/src\//g, "packages/shared/src/contracts/");

  // 4. 替换 packages/contracts/ 为 packages/shared/src/contracts/
  content = content.replace(/packages\/contracts\//g, "packages/shared/src/contracts/");

  // 5. 替换 packages/shared/src/contracts/src/ 为 packages/shared/src/contracts/
  content = content.replace(/packages\/shared\/src\/contracts\/src\//g, "packages/shared/src/contracts/");

  // 6. 替换 contracts/src/ 为 packages/shared/src/contracts/
  content = content.replace(/(?<!packages\/shared\/src\/)contracts\/src\//g, "packages/shared/src/contracts/");

  // 7. 替换 path.join("packages", "contracts", "src", "dto", "workspace-canvas.ts")
  content = content.replace(
    /path\.join\(\s*(['"])packages\1\s*,\s*(['"])contracts\2\s*,\s*(['"])src\3\s*,\s*(['"])dto\4\s*,\s*(['"])workspace-canvas\.ts\5\s*\)/g,
    'path.join("packages", "shared", "src", "contracts", "dto", "workspace-canvas.ts")'
  );

  // 8. 替换 readSource(path.join("packages", "contracts", "src", "dto", "workspace-canvas.ts"))
  content = content.replace(
    /readSource\(\s*path\.join\(\s*(['"])packages\1\s*,\s*(['"])contracts\2\s*,\s*(['"])src\3\s*,\s*(['"])dto\4\s*,\s*(['"])workspace-canvas\.ts\5\s*\)\s*\)/g,
    'readSource("packages/shared/src/contracts/dto/workspace-canvas.ts")'
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    modifiedFiles++;
    console.log(`[Migrated] ${path.relative(testDir, filePath)}`);
  }
}

console.log('Starting refined legacy path migration in test files...');
walkDir(testDir, migrateFile);
console.log(`Migration complete. Modified ${modifiedFiles} files.`);
