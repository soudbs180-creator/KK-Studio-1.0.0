import type {
  PlatformRuntimeCapabilitySnapshotDto,
  PlatformRuntimeJsonValue,
  PlatformRuntimeResultDto,
} from '@kk/shared';
import {
  APP_ARTIFACT_VERSION,
  APP_NAME,
  APP_RELEASE_PHASE,
  APP_RELEASE_SEQUENCE,
  APP_RELEASE_TARGET,
  APP_VERSION,
  APP_DISPLAY_VERSION,
} from '../../config/appInfo.ts';
import type {
  PlatformRuntimeAppInfo,
  PlatformRuntimeOperation,
  PlatformRuntimePort,
} from './PlatformRuntimePort.ts';

const DEFAULT_APP_INFO: PlatformRuntimeAppInfo = Object.freeze({
  name: APP_NAME,
  version: APP_VERSION,
  displayVersion: APP_DISPLAY_VERSION,
  releaseTarget: APP_RELEASE_TARGET,
  releasePhase: APP_RELEASE_PHASE,
  releaseSequence: APP_RELEASE_SEQUENCE,
  artifactVersion: APP_ARTIFACT_VERSION,
});

const DESKTOP_ONLY_OPERATIONS = new Set<PlatformRuntimeOperation>([
  'request-window-action',
  'check-update',
  'install-update',
]);

type PlatformReleaseChannel = PlatformRuntimeCapabilitySnapshotDto['releaseChannel'];

/** Constructor dependencies make capability observations deterministic in tests. */
export type BrowserPlatformRuntimeAdapterOptions = Readonly<{
  appInfo?: PlatformRuntimeAppInfo;
  now?: () => Date;
}>;

function resolveReleaseChannel(releasePhase: string): PlatformReleaseChannel {
  switch (releasePhase) {
    case 'development': return 'development';
    case 'internal': return 'internal';
    case 'canary':
    case 'release-candidate': return 'canary';
    case 'stable': return 'stable';
    default: throw new Error(`Unsupported platform release phase: ${releasePhase}`);
  }
}

function unsupportedResult(
  operation: PlatformRuntimeOperation,
): PlatformRuntimeResultDto {
  if (DESKTOP_ONLY_OPERATIONS.has(operation)) {
    return {
      schemaVersion: 1,
      operation,
      status: 'unsupported',
      reasonCode: 'desktop_only',
      recoveryActions: ['open_documentation'],
    };
  }
  if (operation === 'store-credential-reference') {
    return {
      schemaVersion: 1,
      operation,
      status: 'unsupported',
      reasonCode: 'browser_restricted',
      recoveryActions: ['open_documentation'],
    };
  }
  return {
    schemaVersion: 1,
    operation,
    status: 'unsupported',
    reasonCode: 'capability_unavailable',
    recoveryActions: [],
  };
}

/** Browser implementation of the host boundary; only integrated operations report success. */
export class BrowserPlatformRuntimeAdapter implements PlatformRuntimePort {
  private readonly appInfo: PlatformRuntimeAppInfo;
  private readonly now: () => Date;

  constructor(options: BrowserPlatformRuntimeAdapterOptions = {}) {
    this.appInfo = Object.freeze({ ...(options.appInfo ?? DEFAULT_APP_INFO) });
    this.now = options.now ?? (() => new Date());
  }

  getAppInfo(): PlatformRuntimeAppInfo {
    return this.appInfo;
  }

  getCapabilitySnapshot(): PlatformRuntimeCapabilitySnapshotDto {
    return {
      schemaVersion: 1,
      runtimeKind: 'browser',
      operatingSystem: 'browser',
      appVersion: this.appInfo.version,
      releaseChannel: resolveReleaseChannel(this.appInfo.releasePhase),
      capabilities: [{ capability: 'app-info', availability: 'supported' }],
      observedAt: this.now().toISOString(),
    };
  }

  async execute(
    operation: PlatformRuntimeOperation,
    input?: PlatformRuntimeJsonValue,
  ): Promise<PlatformRuntimeResultDto> {
    void input;
    if (operation === 'get-app-info') {
      return {
        schemaVersion: 1,
        operation,
        status: 'success',
        value: { ...this.appInfo },
      };
    }
    return unsupportedResult(operation);
  }
}
