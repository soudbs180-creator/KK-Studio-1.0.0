import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

async function main() {
  const files = await fg([
    'apps/web/src/**/*.{ts,tsx}',
  ], {
    ignore: [
      'node_modules/**',
      'dist/**',
    ],
  });

  const offenders = [];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    
    if (text.includes('DEPRECATED(test-compat)') || text.includes('A11Y_INTENTIONAL_HIDDEN')) {
      continue;
    }

    const tagRegex = /<[a-zA-Z0-9_\.]+(\s+[^>]*?)/g;
    let match;
    let fileHasOffender = false;
    while ((match = tagRegex.exec(text)) !== null) {
      const attrs = match[1];
      if (attrs.includes('onClick')) {
        const hasHidden = attrs.includes('className="hidden"') || 
                          attrs.includes("className='hidden'") ||
                          attrs.includes("display: 'none'") ||
                          attrs.includes('display: "none"') ||
                          attrs.includes('display:"none"') ||
                          attrs.includes("display:'none'") ||
                          attrs.includes('style={{display:"none"}}') ||
                          attrs.includes('style={{display:\'none\'}}') ||
                          attrs.includes('style={{ display: "none" }}') ||
                          attrs.includes('style={{ display: \'none\' }}');
        if (hasHidden) {
          fileHasOffender = true;
          break;
        }
      }
    }
    if (fileHasOffender) {
      offenders.push(file);
    }
  }

  if (offenders.length) {
    console.error('[Hidden DOM Boundary] Direct business actions on hidden DOM are forbidden:');
    offenders.forEach((file) => console.error(` - ${file}`));
    process.exit(1);
  } else {
    console.log('[Hidden DOM Boundary] Check passed: no hidden active actions found.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
