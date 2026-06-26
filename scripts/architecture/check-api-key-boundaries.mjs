// scripts/architecture/check-api-key-boundaries.mjs
import fs from 'node:fs';
import fg from 'fast-glob';

const SENSITIVE_KEYWORDS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PASSWORD_SALT',
  'STRIPE_SECRET_KEY',
  'USER_API_ENCRYPTION_SECRET',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY'
];

async function main() {
  const files = await fg([
    'apps/web/src/**/*.{ts,tsx,js,jsx}',
  ], {
    ignore: [
      'node_modules/**',
      'dist/**',
    ]
  });

  const offenders = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (line.includes('//') || line.includes('/*')) continue;
      
      // Bypass the harmless user-facing error message regarding missing secret in kkApiServerHealth
      if (line.includes('Local API server is missing USER_API_ENCRYPTION_SECRET')) {
        continue;
      }

      for (const keyword of SENSITIVE_KEYWORDS) {
        // Look for const assignments or variable usages.
        // We ensure we match variable declarations like const GEMINI_API_KEY = ... or raw env strings that could expose private keys.
        const regex = new RegExp(`const\\s+${keyword}\\s*=|\\b${keyword}\\s*:\\s*['"\`]|['"\`].*${keyword}.*['"\`].*(?:=)`, 'i');
        if (regex.test(line) && !line.includes('readRuntimeEnv') && !line.includes('process.env')) {
          offenders.push(`${file}:${i + 1} -> ${line.trim()}`);
        }
      }
    }
  }

  if (offenders.length > 0) {
    console.error('[API Key Boundaries Check] P0 ERROR: Client files must not store or hardcode platform credentials:');
    offenders.slice(0, 10).forEach(off => console.error(` - ${off}`));
    process.exit(1);
  } else {
    console.log('[API Key Boundaries Check] Passed: No forbidden platform secrets found in client files.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
