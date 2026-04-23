import { pathToFileURL } from "node:url";

export * from "./ci/audit-supabase.mjs";
import { runAudit } from "./ci/audit-supabase.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAudit().catch((error) => {
    console.error("[audit-supabase] Unexpected failure:", error);
    process.exitCode = 1;
  });
}
