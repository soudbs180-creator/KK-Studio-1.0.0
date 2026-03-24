import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type JsonRecord = Record<string, unknown>;

interface EncryptedSecretEnvelope {
  __kkUserApiSecret: true;
  alg: "aes-256-gcm";
  v: 1;
  iv: string;
  tag: string;
  data: string;
}

const SECRET_ARRAY_FIELDS = {
  slots: ["key"],
  entries: ["key"],
  providers: ["apiKey"],
} as const;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEncryptedSecretEnvelope(value: unknown): value is EncryptedSecretEnvelope {
  return (
    isRecord(value)
    && value.__kkUserApiSecret === true
    && value.alg === "aes-256-gcm"
    && value.v === 1
    && typeof value.iv === "string"
    && typeof value.tag === "string"
    && typeof value.data === "string"
  );
}

function deriveEncryptionKey(secretSeed: string): Buffer {
  return createHash("sha256")
    .update(`kk-studio:user-api-secrets:${secretSeed}`)
    .digest();
}

function encryptSecretValue(value: string, encryptionKey: Buffer): EncryptedSecretEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    __kkUserApiSecret: true,
    alg: "aes-256-gcm",
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

function decryptSecretValue(value: EncryptedSecretEnvelope, encryptionKey: Buffer): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(value.data, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function transformArraySecretFields(
  value: unknown,
  fields: readonly string[],
  transform: (secret: unknown) => unknown,
): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      return item;
    }

    const nextItem: JsonRecord = { ...item };
    fields.forEach((field) => {
      if (field in nextItem) {
        nextItem[field] = transform(nextItem[field]);
      }
    });
    return nextItem;
  });
}

function transformLegacyArraySecrets(
  value: unknown,
  transform: (secret: unknown) => unknown,
): unknown {
  return transformArraySecretFields(value, ["key"], transform);
}

function transformPayloadSecrets(
  raw: unknown,
  transform: (secret: unknown) => unknown,
): unknown {
  if (Array.isArray(raw)) {
    return transformLegacyArraySecrets(raw, transform);
  }

  if (!isRecord(raw)) {
    return raw;
  }

  const nextPayload: JsonRecord = { ...raw };
  (
    Object.keys(SECRET_ARRAY_FIELDS) as Array<keyof typeof SECRET_ARRAY_FIELDS>
  ).forEach((field) => {
    nextPayload[field] = transformArraySecretFields(
      nextPayload[field],
      SECRET_ARRAY_FIELDS[field],
      transform,
    );
  });

  return nextPayload;
}

export function encryptUserApisPayload(raw: unknown, secretSeed: string): unknown {
  const encryptionKey = deriveEncryptionKey(secretSeed);

  return transformPayloadSecrets(raw, (secret) => {
    if (typeof secret !== "string" || !secret.trim()) {
      return secret;
    }

    if (isEncryptedSecretEnvelope(secret)) {
      return secret;
    }

    return encryptSecretValue(secret, encryptionKey);
  });
}

export function decryptUserApisPayload(raw: unknown, secretSeed: string): unknown {
  const encryptionKey = deriveEncryptionKey(secretSeed);

  return transformPayloadSecrets(raw, (secret) => {
    if (isEncryptedSecretEnvelope(secret)) {
      return decryptSecretValue(secret, encryptionKey);
    }

    return secret;
  });
}
