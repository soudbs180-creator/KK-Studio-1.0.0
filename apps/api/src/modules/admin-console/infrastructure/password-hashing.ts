import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const scryptPrefix = "scrypt";
const scryptKeyLength = 64;

function computeMd5(password: string): string {
  return createHash("md5").update(password, "utf8").digest("hex");
}

export function isLegacyMd5PasswordHash(storedHash: string): boolean {
  const normalized = String(storedHash || "").trim();
  return Boolean(normalized) && !normalized.startsWith(`${scryptPrefix}:`);
}

export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, scryptKeyLength).toString("hex");
  return `${scryptPrefix}:${salt}:${derived}`;
}

export function verifyAdminPasswordHash(password: string, storedHash: string): boolean {
  const normalized = String(storedHash || "").trim();
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith(`${scryptPrefix}:`)) {
    const [, salt, expectedHash] = normalized.split(":");
    if (!salt || !expectedHash) {
      return false;
    }

    const actual = scryptSync(password, salt, scryptKeyLength);
    const expected = Buffer.from(expectedHash, "hex");
    if (actual.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(actual, expected);
  }

  const expectedMd5 = Buffer.from(normalized, "utf8");
  const actualMd5 = Buffer.from(computeMd5(password), "utf8");
  if (expectedMd5.length !== actualMd5.length) {
    return false;
  }

  return timingSafeEqual(expectedMd5, actualMd5);
}
