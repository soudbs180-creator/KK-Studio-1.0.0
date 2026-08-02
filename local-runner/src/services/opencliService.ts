import type { OpencliCommand, OpencliCommandKind } from '../contracts/opencli';
import {
  createOpencliRuntimeSupervisor,
  type RuntimeProcessInvoker,
} from '../runtime/RuntimeProcessSupervisor';
import {
  assertRegisteredOpencliTarget,
  assertSafeOpencliArgument,
} from '../security/opencliTargetPolicy';

export interface OpencliExecutionResult {
  status: 'success';
  summary: string;
  data: Record<string, unknown>;
}

interface OpencliExecutionCommand extends OpencliCommand {
  logId: string;
}

export interface OpencliRuntimeHealth {
  configured: boolean;
  reachable: boolean;
  status: 'ready' | 'disabled' | 'offline';
  version?: string;
  message?: string;
}

function parseOpencliOutput(stdout: string): Record<string, unknown> {
  const normalized = stdout.trim();
  if (!normalized) return {};
  try {
    const parsed: unknown = JSON.parse(normalized);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : { result: parsed };
  } catch {
    return { text: normalized.slice(0, 64_000) };
  }
}

function requirePayloadString(command: OpencliCommand, key: string): string {
  const value = command.payload?.[key];
  if (typeof value !== 'string') {
    throw new Error(`OpenCLI command payload is missing ${key}.`);
  }
  return assertSafeOpencliArgument(value, key);
}

function buildDirectArguments(command: OpencliCommand): string[] {
  const session = 'kk-studio';
  const target = assertSafeOpencliArgument(command.target, 'target');
  const base = ['browser', session];
  switch (command.kind) {
    case 'open':
      return [...base, 'open', assertRegisteredOpencliTarget(target).toString(), '--format', 'json'];
    case 'click':
      return [...base, 'click', target, '--format', 'json'];
    case 'type':
    case 'fill':
      return [...base, command.kind, target, requirePayloadString(command, 'text'), '--format', 'json'];
    case 'select':
      return [...base, 'select', target, requirePayloadString(command, 'value'), '--format', 'json'];
    case 'extract':
    case 'screenshot':
    case 'network':
    case 'state':
      return [...base, command.kind, target, '--format', 'json'];
    default:
      throw new Error(`OpenCLI action requires a registered adapter: ${command.kind}`);
  }
}

/** Executes strict OpenCLI commands through a pinned local binary; no simulated data is returned. */
export class OpencliService {
  constructor(private readonly supervisor: RuntimeProcessInvoker | null = createOpencliRuntimeSupervisor()) {}

  public async getHealth(): Promise<OpencliRuntimeHealth> {
    if (!this.supervisor) {
      return {
        configured: false,
        reachable: false,
        status: 'disabled',
        message: 'OpenCLI executable path and SHA-256 digest are not configured.',
      };
    }
    try {
      const result = await this.supervisor.invoke(['--version']);
      return {
        configured: true,
        reachable: true,
        status: 'ready',
        version: result.stdout.trim().slice(0, 120) || undefined,
      };
    } catch (error) {
      return {
        configured: true,
        reachable: false,
        status: 'offline',
        message: error instanceof Error ? error.message : 'OpenCLI health check failed.',
      };
    }
  }

  public async executeCommand(command: OpencliExecutionCommand): Promise<OpencliExecutionResult> {
    if (!this.supervisor) {
      throw new Error('OpenCLI is not configured on this paired desktop.');
    }
    if (command.kind === 'generate_external') {
      throw new Error('External generation requires a registered provider adapter.');
    }
    if (command.kind === 'inspect_page' || command.kind === 'extract_product') {
      const targetUrl = assertRegisteredOpencliTarget(command.target).toString();
      await this.supervisor.invoke(['browser', 'kk-studio', 'open', targetUrl, '--format', 'json']);
      const result = await this.supervisor.invoke([
        'browser',
        'kk-studio',
        command.kind === 'extract_product' ? 'extract' : 'state',
        '--format',
        'json',
      ]);
      return {
        status: 'success',
        summary: command.kind === 'extract_product' ? 'OpenCLI returned page extraction data.' : 'OpenCLI returned browser state.',
        data: parseOpencliOutput(result.stdout),
      };
    }
    const result = await this.supervisor.invoke(buildDirectArguments(command));
    return {
      status: 'success',
      summary: `OpenCLI completed ${command.kind}.`,
      data: parseOpencliOutput(result.stdout),
    };
  }
}

export const opencliService = new OpencliService();
