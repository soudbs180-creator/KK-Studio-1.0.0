import {
  startLocalApiServer,
} from "./lib/local-api-bootstrap.mjs";

process.env.KKAI_LOCAL_ONLY = "true";

if (process.argv.includes("--check")) {
  process.exit(0);
}

await startLocalApiServer({ skipConfigCheck: true });
