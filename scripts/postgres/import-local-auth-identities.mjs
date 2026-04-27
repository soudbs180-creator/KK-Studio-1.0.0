import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function resolveEnvFile(relativePath) {
  return path.join(repoRoot, relativePath);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((entries, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return entries;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        return entries;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      entries[key] = value;
      return entries;
    }, {});
}

function resolveDatabaseUrl() {
  const explicitUrl = String(process.env.DATABASE_URL || "").trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const apiEnv = parseEnvFile(resolveEnvFile(path.join("apps", "api", ".env.local")));
  return String(apiEnv.DATABASE_URL || "").trim();
}

function resolveAuthIdentityFile() {
  const configuredPath = String(process.env.KK_LOCAL_AUTH_IDENTITY_FILE || "").trim();
  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.join(repoRoot, ".kk-local", "auth-identities.json");
}

function readPasswordUsers(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing local auth identity file: ${filePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const users = Object.values(parsed?.users || {});
  return users
    .filter((user) => (
      user
      && typeof user === "object"
      && typeof user.id === "string"
      && typeof user.email === "string"
      && typeof user.passwordSalt === "string"
      && typeof user.passwordHash === "string"
    ))
    .map((user) => ({
      id: String(user.id).trim(),
      email: String(user.email).trim().toLowerCase(),
      role: String(user.role || "user").trim() || "user",
      status: String(user.status || "active").trim() || "active",
      createdAt: String(user.createdAt || new Date().toISOString()).trim(),
      updatedAt: String(user.updatedAt || user.createdAt || new Date().toISOString()).trim(),
      passwordSalt: String(user.passwordSalt).trim(),
      passwordHash: String(user.passwordHash).trim(),
    }))
    .filter((user) => user.id && user.email && user.passwordSalt && user.passwordHash);
}

async function importUsers() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Set it in apps/api/.env.local or process.env.");
  }

  const authIdentityFile = resolveAuthIdentityFile();
  const users = readPasswordUsers(authIdentityFile);
  if (users.length === 0) {
    console.log(JSON.stringify({
      importedProfiles: 0,
      importedPasswordIdentities: 0,
      sourceUserCount: 0,
      sourceFile: authIdentityFile,
    }));
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const client = await pool.connect();
  try {
    await client.query("begin");

    for (const user of users) {
      await client.query(
        `insert into profiles (
           id,
           email,
           nickname,
           avatar_url,
           role,
           status,
           user_apis,
           created_at,
           updated_at
         ) values (
           $1, $2, null, null, $3, $4, '[]'::jsonb, $5, $6
         )
         on conflict (id) do update
           set email = excluded.email,
               role = excluded.role,
               status = excluded.status,
               updated_at = excluded.updated_at`,
        [user.id, user.email, user.role, user.status, user.createdAt, user.updatedAt],
      );

      await client.query(
        `insert into password_identities (
           user_id,
           password_salt,
           password_hash,
           password_changed_at,
           password_change_code_salt,
           password_change_code_hash,
           password_change_code_expires_at,
           created_at,
           updated_at
         ) values (
           $1, $2, $3, $4, null, null, null, $4, $5
         )
         on conflict (user_id) do update
           set password_salt = excluded.password_salt,
               password_hash = excluded.password_hash,
               password_changed_at = excluded.password_changed_at,
               password_change_code_salt = null,
               password_change_code_hash = null,
               password_change_code_expires_at = null,
               updated_at = excluded.updated_at`,
        [user.id, user.passwordSalt, user.passwordHash, user.createdAt, user.updatedAt],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(JSON.stringify({
    importedProfiles: users.length,
    importedPasswordIdentities: users.length,
    sourceUserCount: users.length,
    sourceFile: authIdentityFile,
  }));
}

await importUsers();
