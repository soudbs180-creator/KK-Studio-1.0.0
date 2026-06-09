throw new Error([
  "scripts/run-api-vps.mjs is retired.",
  "The active backend runtime is server/ Express / VPS.",
  "Use scripts/dev/run-api-dev.mjs for local development or start server/index.js directly in VPS deployments."
].join(" "));
