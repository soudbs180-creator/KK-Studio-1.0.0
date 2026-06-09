console.error([
  "setup-admin-system.js is disabled.",
  "The admin system is now configured through the VPS PostgreSQL/API runtime.",
  "Use the VPS database migrations and server/ admin routes instead.",
].join("\n"));

process.exitCode = 1;
