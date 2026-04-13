import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const tempFileSuffix = ".tmp";
const replaceAttempts = 4;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isRetryableWindowsReplaceError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";

  return code === "EPERM" || code === "EBUSY" || code === "EACCES";
}

export interface FileBackedJsonStoreOptions<TState> {
  filePath: string;
  createEmptyState: () => TState;
  isState: (value: unknown) => value is TState;
}

export class FileBackedJsonStore<TState> {
  private readonly filePath: string;
  private readonly createEmptyState: () => TState;
  private readonly isState: (value: unknown) => value is TState;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: FileBackedJsonStoreOptions<TState>) {
    this.filePath = path.resolve(options.filePath);
    this.createEmptyState = options.createEmptyState;
    this.isState = options.isState;
  }

  async readState(): Promise<TState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return this.isState(parsed) ? parsed : this.createEmptyState();
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return this.createEmptyState();
      }

      throw error;
    }
  }

  async withState<TResult>(
    mutator: (state: TState) => Promise<{ state: TState; result: TResult }> | { state: TState; result: TResult },
  ): Promise<TResult> {
    let resolvedResult: TResult | undefined;

    const run = async () => {
      const currentState = await this.readState();
      const { state: nextState, result } = await mutator(currentState);
      await this.writeState(nextState);
      resolvedResult = result;
    };

    const writeTask = this.writeQueue.then(run, run);
    this.writeQueue = writeTask.then(() => undefined, () => undefined);
    await writeTask;
    return resolvedResult as TResult;
  }

  private async writeState(state: TState): Promise<void> {
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true });
    await this.cleanupStaleTempFiles(directory);

    const serializedState = JSON.stringify(state, null, 2);
    const tempPath = `${this.filePath}.${process.pid}.${randomUUID()}${tempFileSuffix}`;

    await writeFile(tempPath, serializedState, "utf8");

    try {
      await this.commitTempFile(tempPath, serializedState);
    } finally {
      await rm(tempPath, { force: true }).catch(() => undefined);
    }
  }

  private async commitTempFile(tempPath: string, serializedState: string): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt < replaceAttempts; attempt += 1) {
      try {
        await rename(tempPath, this.filePath);
        return;
      } catch (error) {
        lastError = error;
        if (!isRetryableWindowsReplaceError(error) || attempt === replaceAttempts - 1) {
          break;
        }

        await delay(30 * (attempt + 1));
      }
    }

    if (isRetryableWindowsReplaceError(lastError)) {
      await writeFile(this.filePath, serializedState, "utf8");
      return;
    }

    try {
      await copyFile(tempPath, this.filePath);
    } catch {
      throw lastError;
    }
  }

  private async cleanupStaleTempFiles(directory: string): Promise<void> {
    const fileName = path.basename(this.filePath);
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);

    await Promise.all(entries.map(async (entry) => {
      if (!entry.isFile()) {
        return;
      }

      if (!entry.name.startsWith(`${fileName}.`) || !entry.name.endsWith(tempFileSuffix)) {
        return;
      }

      await rm(path.join(directory, entry.name), { force: true }).catch(() => undefined);
    }));
  }
}
