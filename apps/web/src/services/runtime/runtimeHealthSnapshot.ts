import {
  RuntimeHealthSnapshotDtoSchema,
  type RuntimeHealthSnapshotDto,
  type RuntimeServiceHealthDto,
  type RuntimeServiceId,
} from '@kk/shared';
import { getKkApiServerHealth } from '../api/kkApiServerHealth';

const LOCAL_RUNNER_BASE_URL = 'http://127.0.0.1:9099';
const PROBE_TIMEOUT_MS = 4_000;

interface ProbeDefinition {
  serviceId: Exclude<RuntimeServiceId, 'api-gateway'>;
  label: string;
  path: string;
  requiresToken: boolean;
  recoveryTarget: string;
}

const LOCAL_PROBES: ProbeDefinition[] = [
  {
    serviceId: 'local-runner',
    label: 'Local Runner',
    path: '/api/health',
    requiresToken: false,
    recoveryTarget: '/settings/provider-routes',
  },
  {
    serviceId: 'cliproxyapi',
    label: 'CLIProxyAPI',
    path: '/api/provider-runtime/health',
    requiresToken: true,
    recoveryTarget: '/settings/provider-routes',
  },
  {
    serviceId: 'opencli',
    label: 'OpenCLI Bridge',
    path: '/api/opencli/health',
    requiresToken: true,
    recoveryTarget: '/settings/provider-routes',
  },
  {
    serviceId: 'browser-bridge',
    label: 'Browser Session',
    path: '/api/browser/sessions',
    requiresToken: true,
    recoveryTarget: '/settings/provider-routes',
  },
];

function readLocalToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('kk_local_runner_token')?.trim() || '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function createRecoveryActions(
  serviceId: RuntimeServiceId,
  recoveryTarget: string,
): RuntimeServiceHealthDto['recoveryActions'] {
  return [
    { id: `retry-${serviceId}`, label: '重新检测', action: 'retry' },
    {
      id: `settings-${serviceId}`,
      label: '打开配置',
      action: 'open-settings',
      target: recoveryTarget,
    },
  ];
}

async function fetchJsonWithTimeout(
  url: string,
  token: string,
): Promise<{ elapsedMs: number; response: Response; payload: unknown }> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return {
      elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
      response,
      payload,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeLocalProbe(
  definition: ProbeDefinition,
  probe: { elapsedMs: number; response: Response; payload: unknown },
): RuntimeServiceHealthDto {
  const checkedAt = new Date().toISOString();
  const payload = asRecord(probe.payload);
  const runtimeStatus = readString(payload, 'status');
  const sessionCount = Array.isArray(probe.payload) ? probe.payload.length : undefined;
  const disabled = runtimeStatus === 'disabled';
  const ready = probe.response.ok && !disabled && (
    definition.serviceId !== 'browser-bridge' || (sessionCount ?? 0) > 0
  );
  const status = disabled ? 'disabled' : ready ? 'ready' : probe.response.ok ? 'degraded' : 'offline';
  const message = definition.serviceId === 'browser-bridge' && probe.response.ok && sessionCount === 0
    ? '浏览器 Bridge 已启动，但当前没有已配对会话。'
    : readString(payload, 'message');

  return {
    serviceId: definition.serviceId,
    label: definition.label,
    status,
    reachable: probe.response.ok,
    latencyMs: probe.elapsedMs,
    version: readString(payload, 'version'),
    checkedAt,
    message,
    recoveryActions: status === 'ready'
      ? [{ id: `retry-${definition.serviceId}`, label: '重新检测', action: 'retry' }]
      : createRecoveryActions(definition.serviceId, definition.recoveryTarget),
  };
}

async function probeLocalService(
  definition: ProbeDefinition,
  token: string,
): Promise<RuntimeServiceHealthDto> {
  const checkedAt = new Date().toISOString();
  if (definition.requiresToken && !token) {
    return {
      serviceId: definition.serviceId,
      label: definition.label,
      status: 'disabled',
      reachable: false,
      checkedAt,
      message: '尚未配置 Local Runner 配对凭据。',
      recoveryActions: createRecoveryActions(definition.serviceId, definition.recoveryTarget),
    };
  }

  try {
    const probe = await fetchJsonWithTimeout(
      `${LOCAL_RUNNER_BASE_URL}${definition.path}`,
      definition.requiresToken ? token : '',
    );
    return normalizeLocalProbe(definition, probe);
  } catch (error) {
    return {
      serviceId: definition.serviceId,
      label: definition.label,
      status: 'offline',
      reachable: false,
      checkedAt,
      message: error instanceof Error ? error.message : '运行时健康检查失败。',
      recoveryActions: createRecoveryActions(definition.serviceId, definition.recoveryTarget),
    };
  }
}

async function probeApiGateway(): Promise<RuntimeServiceHealthDto> {
  const startedAt = performance.now();
  const health = await getKkApiServerHealth({ forceRefresh: true });
  const status = health.reachable && (health.status === 'ok' || health.status === 'healthy')
    ? 'ready'
    : health.reachable ? 'degraded' : 'offline';
  return {
    serviceId: 'api-gateway',
    label: 'API Gateway',
    status,
    reachable: health.reachable,
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    checkedAt: new Date(health.fetchedAt).toISOString(),
    message: health.errorMessage,
    recoveryActions: status === 'ready'
      ? [{ id: 'retry-api-gateway', label: '重新检测', action: 'retry' }]
      : createRecoveryActions('api-gateway', '/settings/capability-sources'),
  };
}

async function readBuildManifest(): Promise<RuntimeHealthSnapshotDto['build']> {
  try {
    const response = await fetch('/app-version.json', { cache: 'no-store' });
    if (!response.ok) return undefined;
    const manifest = asRecord(await response.json());
    return {
      version: readString(manifest, 'version'),
      commitSha: readString(manifest, 'commitSha'),
      deploymentTarget: readString(manifest, 'deploymentTarget'),
    };
  } catch {
    return undefined;
  }
}

/** Probes every runtime independently so one healthy service never masks another failure. */
export async function getRuntimeHealthSnapshot(): Promise<RuntimeHealthSnapshotDto> {
  const token = readLocalToken();
  const [apiGateway, ...localServices] = await Promise.all([
    probeApiGateway(),
    ...LOCAL_PROBES.map((definition) => probeLocalService(definition, token)),
  ]);
  const build = await readBuildManifest();
  return RuntimeHealthSnapshotDtoSchema.parse({
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    services: [apiGateway, ...localServices],
    ...(build ? { build } : {}),
  });
}
