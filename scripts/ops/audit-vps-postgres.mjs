import { pathToFileURL } from "node:url";

export * from "../ci/audit-vps-postgres.mjs";
import { runAudit } from "../ci/audit-vps-postgres.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAudit().catch((error) => {
    console.error("[audit-vps-postgres] Unexpected failure:", error);
    process.exitCode = 1;
  });
}
