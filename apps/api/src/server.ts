import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { startServer } = require("../../../server/index.js") as {
  startServer: (port?: number, options?: { skipConfigCheck?: boolean }) => unknown;
};

export interface StartApiServerOptions {
  allowDegradedPersistence?: boolean;
  skipConfigCheck?: boolean;
}

export async function startApiServer(
  port = Number(process.env.PORT || 3001),
  options: StartApiServerOptions = {},
) {
  process.env.PORT = String(port);
  if (options.allowDegradedPersistence === false) {
    process.env.RUN_KK_API_SKELETON = "false";
  }

  return startServer(port, {
    skipConfigCheck: options.skipConfigCheck,
  });
}
