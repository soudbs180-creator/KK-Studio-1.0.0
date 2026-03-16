import { runAudit } from './audit-supabase.mjs';

runAudit().catch((error) => {
  console.error('[verify-supabase] Unexpected failure:', error);
  process.exitCode = 1;
});
