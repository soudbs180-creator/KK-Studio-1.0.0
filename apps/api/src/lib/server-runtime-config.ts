import { Client } from "pg";

export interface ServerRuntimeConfig {
  databaseUrl?: string;
  pgHost?: string;
  pgPort?: string;
  pgDatabase?: string;
  pgUser?: string;
  pgPassword?: string;
  pgSsl?: string;
}

export interface ServerRuntimePersistenceProbe {
  postgresConfigValid: boolean;
  blockers: string[];
}

function readEnv(key: string): string | undefined {
  const value = String(process.env[key] || "").trim();
  return value || undefined;
}

export function resolveServerRuntimeConfig(): ServerRuntimeConfig {
  return {
    databaseUrl: readEnv("DATABASE_URL"),
    pgHost: readEnv("PGHOST"),
    pgPort: readEnv("PGPORT"),
    pgDatabase: readEnv("PGDATABASE"),
    pgUser: readEnv("PGUSER"),
    pgPassword: readEnv("PGPASSWORD"),
    pgSsl: readEnv("PGSSL"),
  };
}

function buildPgClientConfig(config: ServerRuntimeConfig) {
  if (config.databaseUrl) {
    return {
      connectionString: config.databaseUrl,
      ssl: config.pgSsl === "true" ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    host: config.pgHost,
    port: config.pgPort ? Number(config.pgPort) : undefined,
    database: config.pgDatabase,
    user: config.pgUser,
    password: config.pgPassword,
    ssl: config.pgSsl === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

export async function probeServerRuntimePersistence(
  config: ServerRuntimeConfig,
): Promise<ServerRuntimePersistenceProbe> {
  const hasConnectionConfig = Boolean(
    config.databaseUrl || (config.pgHost && config.pgDatabase && config.pgUser),
  );
  if (!hasConnectionConfig) {
    return {
      postgresConfigValid: false,
      blockers: ["PostgreSQL connection config is incomplete"],
    };
  }

  const client = new Client(buildPgClientConfig(config));
  try {
    await client.connect();
    await client.query("select 1");
    return {
      postgresConfigValid: true,
      blockers: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      postgresConfigValid: false,
      blockers: [message],
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}
