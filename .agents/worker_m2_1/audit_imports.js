import fs from 'fs';
import path from 'path';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.match(/import\s+.*?from\s+['"](.*?)['"]/g);
      if (matches) {
        for (const m of matches) {
          const specifier = m.match(/from\s+['"](.*?)['"]/)[1];
          if (!specifier.startsWith('.')) {
            console.log(`${fullPath.replace(/\\/g, '/')}: ${m}`);
          }
        }
      }
    }
  }
}

console.log('=== AUDIT NON-RELATIVE IMPORTS IN PACKAGES/SHARED/SRC ===');
walk('d:/KK Studio/packages/shared/src');
console.log('=== AUDIT COMPLETE ===');
