console.error([
  "verify_connection.js is disabled.",
  "Hosted/runtime connectivity is now checked through the VPS API health and PostgreSQL probes.",
  "Run npm run api:diagnose and npm run release:hosted:check instead.",
].join("\n"));

process.exitCode = 1;
