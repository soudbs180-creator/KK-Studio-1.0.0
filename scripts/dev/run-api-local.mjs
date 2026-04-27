import {
  startLocalApiServer,
} from "../lib/local-api-bootstrap.mjs";

function keepDetachedApiProcessAlive(server) {
  const keepaliveTimer = setInterval(() => {}, 60_000);
  server?.once?.("close", () => {
    clearInterval(keepaliveTimer);
  });
}

process.env.KKAI_LOCAL_ONLY = "true";

if (process.argv.includes("--check")) {
  process.exit(0);
}

const server = await startLocalApiServer({ skipConfigCheck: true });
keepDetachedApiProcessAlive(server);
