// scripts/architecture/check-no-hardcoded-vps-fallback.mjs
import fs from 'node:fs';
import path from 'node:path';

const IP_BLACKLIST = [
  '172-245-156-16.sslip.io',
  '172.245.156.16'
];

function scanDirectory(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        scanDirectory(filePath, files);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      files.push(filePath);
    }
  }
  return files;
}

async function main() {
  const srcDir = 'apps/web/src';
  if (!fs.existsSync(srcDir)) {
    console.error(`[No Hardcoded VPS Check] ERROR: ${srcDir} does not exist.`);
    process.exit(1);
  }

  const files = scanDirectory(srcDir);
  let failed = false;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const ip of IP_BLACKLIST) {
      if (content.includes(ip)) {
        console.error(`[No Hardcoded VPS Check] P0 ERROR: Found hardcoded VPS IP/domain "${ip}" in: ${file}`);
        failed = true;
      }
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log('[No Hardcoded VPS Check] Passed: No hardcoded VPS fallback IPs found in frontend source.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
