import { Pool, type PoolConfig, type QueryResult } from "pg";

export interface PostgresQueryable {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

let sharedPool: Pool | null = null;

function readNumberEnv(name: string): number | undefined {
  const value = Number(process.env[name] || "");
  return Number.isFinite(value) ? value : undefined;
}

function normalizeHostname(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
}

function isLoopbackOrPrivateHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost"
    || normalized === "::1"
    || normalized.startsWith("127.")
    || normalized.startsWith("10.")
    || normalized.startsWith("192.168.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
}

function resolveSslModeFromEnv(): string {
  return String(process.env.PGSSLMODE || process.env.PGSSL || "").trim().toLowerCase();
}

function resolvePostgresSslConfig(connectionString?: string): PoolConfig["ssl"] {
  const sslMode = resolveSslModeFromEnv();
  if (sslMode === "disable" || sslMode === "false" || sslMode === "0" || sslMode === "off") {
    return undefined;
  }

  if (["true", "1", "on", "require", "prefer", "no-verify"].includes(sslMode)) {
    return { rejectUnauthorized: false };
  }

  if (!connectionString) {
    return undefined;
  }

  try {
    const url = new URL(connectionString);
    const urlSslMode = String(url.searchParams.get("sslmode") || url.searchParams.get("ssl") || "").trim().toLowerCase();
    if (urlSslMode === "disable" || urlSslMode === "false" || urlSslMode === "0" || urlSslMode === "off") {
      return undefined;
    }
    if (["true", "1", "on", "require", "prefer", "no-verify"].includes(urlSslMode)) {
      return { rejectUnauthorized: false };
    }
    return isLoopbackOrPrivateHostname(url.hostname) ? undefined : { rejectUnauthorized: false };
  } catch {
    return undefined;
  }
}

export function resolvePostgresConfig(): PoolConfig | null {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (connectionString) {
    return {
      connectionString,
      ssl: resolvePostgresSslConfig(connectionString),
      max: readNumberEnv("PGPOOL_MAX") || 10,
      idleTimeoutMillis: readNumberEnv("PG_IDLE_TIMEOUT_MS") || 30_000,
      connectionTimeoutMillis: readNumberEnv("PG_CONNECTION_TIMEOUT_MS") || 5_000,
    };
  }

  const host = String(process.env.PGHOST || "").trim();
  const database = String(process.env.PGDATABASE || "").trim();
  const user = String(process.env.PGUSER || "").trim();
  if (!host || !database || !user) {
    return null;
  }

  return {
    host,
    port: readNumberEnv("PGPORT") || 5432,
    database,
    user,
    password: String(process.env.PGPASSWORD || ""),
    ssl: resolvePostgresSslConfig(),
    max: readNumberEnv("PGPOOL_MAX") || 10,
    idleTimeoutMillis: readNumberEnv("PG_IDLE_TIMEOUT_MS") || 30_000,
    connectionTimeoutMillis: readNumberEnv("PG_CONNECTION_TIMEOUT_MS") || 5_000,
  };
}

export function hasPostgresConfig(): boolean {
  return resolvePostgresConfig() !== null;
}

export function getSharedPostgresPool(): Pool {
  if (sharedPool) {
    return sharedPool;
  }

  const config = resolvePostgresConfig();
  if (!config) {
    throw new Error("PostgreSQL configuration is unavailable. Set DATABASE_URL or PGHOST/PGDATABASE/PGUSER.");
  }

  sharedPool = new Pool(config);
  return sharedPool;
}

export async function resetSharedPostgresPoolForTests(): Promise<void> {
  if (!sharedPool) {
    return;
  }

  await sharedPool.end();
  sharedPool = null;
}
