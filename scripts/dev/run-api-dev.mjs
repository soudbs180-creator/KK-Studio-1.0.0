import {
  assertLocalApiConfig,
  startLocalApiServer,
} from "../lib/local-api-bootstrap.mjs";

await assertLocalApiConfig();

if (process.argv.includes("--check")) {
  process.exit(0);
}

await startLocalApiServer({ skipConfigCheck: true });
