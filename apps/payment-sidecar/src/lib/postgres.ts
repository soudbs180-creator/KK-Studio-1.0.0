import { Pool, type PoolConfig, type QueryResult } from "pg";

export interface PostgresQueryable {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

let sharedPool: Pool | null = null;

function readNumberEnv(name: string): number | undefined {
  const value = Number(process.env[name] || "");
  return Number.isFinite(value) ? value : undefined;
}

export function resolvePostgresConfig(): PoolConfig | null {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (connectionString) {
    return {
      connectionString,
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
    ssl: String(process.env.PGSSL || "").trim().toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : undefined,
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
