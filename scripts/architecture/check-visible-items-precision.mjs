// scripts/architecture/check-visible-items-precision.mjs
import fs from 'node:fs';

async function main() {
  const filePath = 'apps/web/src/app/useVisibleCanvasItems.ts';
  if (!fs.existsSync(filePath)) {
    console.error(`[Visible Items Precision Check] ERROR: ${filePath} does not exist.`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // 必须调用 spatialIndex.getNodeBounds 并且存在 rectIntersect 的裁剪逻辑判断
  const hasGetNodeBounds = content.includes('spatialIndex.getNodeBounds');
  const hasIntersectionChecks = content.includes('bounds.x + bounds.width < vLeft') || content.includes('bounds.x > vRight');
  const hasForceVisibleCheck = content.includes('isForceVisible');

  if (!hasGetNodeBounds) {
    console.error(`[Visible Items Precision Check] P0 ERROR: Missing spatialIndex.getNodeBounds call in ${filePath}`);
    process.exit(1);
  }

  if (!hasIntersectionChecks) {
    console.error(`[Visible Items Precision Check] P0 ERROR: Missing precise viewport culling intersection geometry check in ${filePath}`);
    process.exit(1);
  }

  if (!hasForceVisibleCheck) {
    console.error(`[Visible Items Precision Check] P0 ERROR: Missing force visible bypass logic (isForceVisible) in ${filePath}`);
    process.exit(1);
  }

  console.log('[Visible Items Precision Check] Passed: Precise viewport culling with secondary rect culling check is intact.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
