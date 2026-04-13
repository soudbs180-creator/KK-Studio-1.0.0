import { startApiServer } from "../apps/api/src/server.ts";

const port = Number(process.env.PORT || 3001);

await startApiServer(port, {
  allowDegradedPersistence: false,
});
