import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { applyPrimaryEnvToProcess } from "../lib/env-contract.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..", "..");

const DEFAULT_TUNNEL_HOST = "127.0.0.1";
const DEFAULT_TUNNEL_PORT = 15432;

function readTunnelHost(env = process.env) {
  return String(env.KK_PG_TUNNEL_HOST || DEFAULT_TUNNEL_HOST).trim();
}

function readTunnelPort(env = process.env) {
  const rawValue = String(env.KK_PG_TUNNEL_PORT || DEFAULT_TUNNEL_PORT).trim();
  const port = Number(rawValue);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`KK_PG_TUNNEL_PORT must be a valid TCP port. Received: ${rawValue || "<empty>"}.`);
  }
  return port;
}

function isLocalTunnelHost(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "::1" || normalized.startsWith("127.");
}

export function rewriteDatabaseUrlForTunnel(databaseUrl, options = {}) {
  const tunnelHost = options.host || DEFAULT_TUNNEL_HOST;
  const tunnelPort = options.port || DEFAULT_TUNNEL_PORT;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before using the VPS PostgreSQL tunnel wrapper.");
  }

  if (!isLocalTunnelHost(tunnelHost)) {
    throw new Error("KK_PG_TUNNEL_HOST must point to a local SSH tunnel host such as 127.0.0.1.");
  }

  const url = new URL(databaseUrl);
  url.hostname = tunnelHost;
  url.port = String(tunnelPort);
  url.searchParams.delete("ssl");
  url.searchParams.delete("sslmode");
  return url.toString();
}

export function waitForTunnel(host, port, timeoutMs = 1_500) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(
        new Error(
          `PostgreSQL SSH tunnel is not reachable at ${host}:${port}. `
          + "Start a tunnel such as ssh -L 15432:127.0.0.1:5432 root@<vps-host> first.",
        ),
      );
    }, timeoutMs);

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(
        new Error(
          `PostgreSQL SSH tunnel is not reachable at ${host}:${port}: ${error.message}`,
        ),
      );
    });
  });
}

export async function configureTunnelDatabaseUrl(env = process.env) {
  applyPrimaryEnvToProcess(repoRoot);

  const tunnelHost = readTunnelHost(env);
  const tunnelPort = readTunnelPort(env);
  await waitForTunnel(tunnelHost, tunnelPort);

  env.DATABASE_URL = rewriteDatabaseUrlForTunnel(env.DATABASE_URL, {
    host: tunnelHost,
    port: tunnelPort,
  });

  if (!String(env.PGSSLMODE || "").trim()) {
    env.PGSSLMODE = "disable";
  }
}

await configureTunnelDatabaseUrl();
await import(pathToFileURL(path.join(repoRoot, "scripts", "dev", "run-api-dev.mjs")).href);
