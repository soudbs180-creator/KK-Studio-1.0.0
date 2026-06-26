// scripts/architecture/check-no-legacy-canvas-import.mjs
import fs from 'node:fs';
import path from 'node:path';

function scanDirectory(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        scanDirectory(filePath, files);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      files.push(filePath);
    }
  }
  return files;
}

async function main() {
  const srcDir = 'apps/web/src';
  if (!fs.existsSync(srcDir)) {
    console.error(`[No Legacy Canvas Import Check] ERROR: ${srcDir} does not exist.`);
    process.exit(1);
  }

  const files = scanDirectory(srcDir);
  let failed = false;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    // 匹配类似: from '.../components/canvas/Canvas' 或 import('.../components/canvas/Canvas') 
    // 但排除 CanvasGroupComponent, CanvasLayerRenderer 等含有 Canvas 的前缀
    const legacyImportRegex = /from\s+['"][^'"]*\/components\/canvas\/Canvas['"]/g;
    const legacyDynamicImportRegex = /import\(['"][^'"]*\/components\/canvas\/Canvas['"]\)/g;

    if (legacyImportRegex.test(content) || legacyDynamicImportRegex.test(content)) {
      console.error(`[No Legacy Canvas Import Check] P0 ERROR: Found legacy Canvas component import in: ${file}`);
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log('[No Legacy Canvas Import Check] Passed: No legacy Canvas component imports found.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
