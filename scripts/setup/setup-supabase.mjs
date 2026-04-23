import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
const projectRefPath = path.join(repoRoot, 'supabase', '.temp', 'project-ref');

function getLatestMigrationFile() {
  if (!fs.existsSync(migrationsDir)) return null;

  return fs
    .readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort()
    .at(-1) || null;
}

const latestMigration = getLatestMigrationFile();
const projectRef = fs.existsSync(projectRefPath)
  ? fs.readFileSync(projectRefPath, 'utf8').trim()
  : process.env.SUPABASE_PROJECT_REF || '';

console.log('========================================');
console.log('KK Studio Supabase Setup Guide');
console.log('========================================');
console.log('');
console.log(`Project ref: ${projectRef || '(missing)'}`);
console.log(`Latest forward-only migration: ${latestMigration || '(missing)'}`);
console.log('');
console.log('Canonical runtime contract');
console.log('- profiles: identity + user_apis');
console.log('- user_credits: balance source of truth');
console.log('- credit_transactions: canonical ledger');
console.log('- admin_credit_models: system model routing');
console.log('- temp_users: temporary identities');
console.log('- secure-model-proxy: required edge runtime');
console.log('');
console.log('Recommended workflow');
console.log('1. supabase link --project-ref <project-ref>');
console.log('2. supabase db push');
console.log('3. npm run supabase:audit');
console.log('4. Deploy secure-model-proxy if the audit reports it missing');
console.log('');
console.log('Notes');
console.log('- Do not replay the 2025 bootstrap SQL as a fresh setup source.');
console.log('- The project now relies on forward-only consolidation migrations from the current remote state.');
console.log('- `payment-server/.env` must contain a real `SUPABASE_SERVICE_ROLE_KEY`; the placeholder in `.env.example` is not enough.');
