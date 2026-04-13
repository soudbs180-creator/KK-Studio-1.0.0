import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  InMemoryAuthIdentityStore,
  type PersistedAuthIdentityState,
} from "./in-memory-auth-identity-store.ts";

export interface FileBackedAuthIdentityStoreOptions {
  filePath?: string;
}

const tempFileSuffix = ".tmp";

function buildDefaultFilePath(): string {
  const configuredPath = String(process.env.KK_LOCAL_AUTH_IDENTITY_FILE || "").trim();
  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.resolve(process.cwd(), ".kk-local", "auth-identities.json");
}

function isPersistedAuthIdentityState(value: unknown): value is PersistedAuthIdentityState {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as { version?: unknown }).version === 1
    && typeof (value as { users?: unknown }).users === "object"
    && !Array.isArray((value as { users?: unknown }).users)
    && typeof (value as { sessions?: unknown }).sessions === "object"
    && !Array.isArray((value as { sessions?: unknown }).sessions)
  );
}

function readPersistedState(filePath: string): PersistedAuthIdentityState | undefined {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return isPersistedAuthIdentityState(parsed) ? parsed : undefined;
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export class FileBackedAuthIdentityStore extends InMemoryAuthIdentityStore {
  private readonly filePath: string;

  constructor(options: FileBackedAuthIdentityStoreOptions = {}) {
    const filePath = options.filePath?.trim()
      ? path.resolve(options.filePath.trim())
      : buildDefaultFilePath();

    super(readPersistedState(filePath));
    this.filePath = filePath;
  }

  protected override afterStateChange(): void {
    this.writeState(this.snapshotState());
  }

  private writeState(state: PersistedAuthIdentityState): void {
    const directory = path.dirname(this.filePath);
    mkdirSync(directory, { recursive: true });

    const serializedState = JSON.stringify(state, null, 2);
    const tempPath = `${this.filePath}.${process.pid}.${randomUUID()}${tempFileSuffix}`;

    writeFileSync(tempPath, serializedState, "utf8");
    try {
      copyFileSync(tempPath, this.filePath);
    } finally {
      rmSync(tempPath, { force: true });
    }
  }
}
