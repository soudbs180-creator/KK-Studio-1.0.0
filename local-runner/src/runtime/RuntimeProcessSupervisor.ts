import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface RuntimeProcessSupervisorConfig {
  executablePath: string;
  executableSha256: string;
}

export interface RuntimeInvocationResult {
  stdout: string;
}

export interface RuntimeProcessInvoker {
  invoke: (argumentsList: readonly string[]) => Promise<RuntimeInvocationResult>;
}

function normalizeSha256(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('OPENCLI_EXECUTABLE_SHA256 must be a 64-character SHA-256 digest.');
  }
  return normalized;
}

/** Executes one pinned OpenCLI binary with fixed safety limits and no shell. */
export class RuntimeProcessSupervisor implements RuntimeProcessInvoker {
  private readonly executablePath: string;
  private readonly executableSha256: string;
  private verified = false;

  constructor(config: RuntimeProcessSupervisorConfig) {
    if (!isAbsolute(config.executablePath)) {
      throw new Error('OPENCLI_EXECUTABLE_PATH must be absolute.');
    }
    this.executablePath = resolve(config.executablePath);
    this.executableSha256 = normalizeSha256(config.executableSha256);
  }

  private verifyExecutable(): void {
    if (this.verified) return;
    const digest = createHash('sha256')
      .update(readFileSync(this.executablePath))
      .digest('hex');
    if (digest !== this.executableSha256) {
      throw new Error('Configured OpenCLI binary failed SHA-256 verification.');
    }
    this.verified = true;
  }

  public async invoke(argumentsList: readonly string[]): Promise<RuntimeInvocationResult> {
    this.verifyExecutable();
    const { stdout } = await execFileAsync(this.executablePath, [...argumentsList], {
      shell: false,
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
      env: {
        PATH: process.env.PATH,
        OPENCLI_PROFILE: process.env.OPENCLI_PROFILE,
        OPENCLI_WINDOW: 'background',
        OPENCLI_KEEP_TAB: 'true',
      },
    });
    return { stdout };
  }
}

export function createOpencliRuntimeSupervisor(): RuntimeProcessSupervisor | null {
  const executablePath = process.env.OPENCLI_EXECUTABLE_PATH?.trim();
  const executableSha256 = process.env.OPENCLI_EXECUTABLE_SHA256?.trim();
  if (!executablePath || !executableSha256) return null;
  return new RuntimeProcessSupervisor({ executablePath, executableSha256 });
}
