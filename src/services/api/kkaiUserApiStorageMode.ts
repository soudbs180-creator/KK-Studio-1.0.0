import type { KkApiRepositoryBackend, KkApiServerHealth } from './kkApiServerHealth.ts';

type UserApiStorageHealthShape = Pick<KkApiServerHealth, 'reachable' | 'persistence'> & {
  repositories: Pick<KkApiServerHealth['repositories'], 'authData'>;
};

export type KkaiUserApiStorageMode = 'local-file-ready' | 'cloud-ready' | 'not-ready';

function isReadyBackend(backend: KkApiRepositoryBackend): boolean {
  return backend === 'local-file' || backend === 'supabase';
}

export function resolveKkaiUserApiStorageMode(
  health: UserApiStorageHealthShape | null | undefined,
): KkaiUserApiStorageMode {
  if (
    !health
    || !health.reachable
    || !isReadyBackend(health.repositories.authData)
    || !health.persistence.userApiKeys
    || !health.persistence.keyManager
  ) {
    return 'not-ready';
  }

  return health.repositories.authData === 'local-file'
    ? 'local-file-ready'
    : 'cloud-ready';
}

export function isKkaiUserApiStorageReady(
  health: UserApiStorageHealthShape | null | undefined,
): boolean {
  return resolveKkaiUserApiStorageMode(health) !== 'not-ready';
}
