import type {
  PlatformRuntimeCapabilitySnapshotDto,
  PlatformRuntimeJsonValue,
  PlatformRuntimeResultDto,
} from '@kk/shared';

export type PlatformRuntimeOperation = PlatformRuntimeResultDto['operation'];

/** Stable application identity exposed by a host without leaking native implementation details. */
export type PlatformRuntimeAppInfo = Readonly<{
  name: string;
  version: string;
  displayVersion: string;
  releaseTarget: string;
  releasePhase: string;
  releaseSequence: number;
  artifactVersion: string;
}>;

/**
 * Narrow host I/O boundary used by Web components.
 * Product orchestration and authoritative execution state stay outside this adapter.
 */
export interface PlatformRuntimePort {
  getAppInfo(): PlatformRuntimeAppInfo;
  getCapabilitySnapshot(): PlatformRuntimeCapabilitySnapshotDto;
  execute(
    operation: PlatformRuntimeOperation,
    input?: PlatformRuntimeJsonValue,
  ): Promise<PlatformRuntimeResultDto>;
}
