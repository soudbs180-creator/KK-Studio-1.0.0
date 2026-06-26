// scripts/architecture/check-generation-routing-boundaries.mjs
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
      'apps/web/src/features/generation/**',
      'apps/web/src/services/llm/generationService.ts',
      'apps/web/src/services/model/**', // Low-level model proxies allowed
    ],
  });

  const offenders = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    // Check if secureModelProxy imports direct call functions
    if (
      content.includes('callLocalUserRouteProxy') ||
      content.includes('callSecureSystemProxy') ||
      content.includes('@google/generative-ai') ||
      content.includes('openai') && content.includes('new OpenAI')
    ) {
      offenders.push(file);
    }
  }

  if (offenders.length > 0) {
    console.error('[Routing Boundaries Check] P0 ERROR: Only GenerationService is allowed to call secureModelProxy functions or Provider SDKs directly. The following files violate this boundary:');
    offenders.forEach(f => console.error(` - ${f}`));
    process.exit(1);
  } else {
    console.log('[Routing Boundaries Check] Passed: All generation requests are channeled through generateService.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
