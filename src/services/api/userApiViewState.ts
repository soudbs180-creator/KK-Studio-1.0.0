export type UserApiWorkbenchStage =
  | 'unauthenticated'
  | 'local-api-unavailable'
  | 'readonly-fallback'
  | 'syncing'
  | 'editable';

export interface UserApiViewStateInput {
  hasReadonlySnapshot: boolean;
  isApiReachable?: boolean;
  isAuthenticated: boolean;
  isPersistenceDegraded: boolean;
  runtimeOfficialCount: number;
  runtimeProviderCount: number;
}

export interface UserApiViewState {
  stage: UserApiWorkbenchStage;
  isHydratingRuntimeUserApis: boolean;
  providerActionsDisabled: boolean;
  providerEditorReadOnly: boolean;
  shouldUseReadonlyProfileFallback: boolean;
  shouldUseReadonlySnapshotForDisplay: boolean;
  userApiActionsDisabled: boolean;
  userApiEditorDisabled: boolean;
}

export function resolveUserApiViewState(
  input: UserApiViewStateInput,
): UserApiViewState {
  const shouldUseReadonlyProfileFallback =
    input.hasReadonlySnapshot
    && input.runtimeOfficialCount === 0
    && input.runtimeProviderCount === 0;

  const isHydratingRuntimeUserApis =
    shouldUseReadonlyProfileFallback
    && !input.isPersistenceDegraded;

  const shouldUseReadonlySnapshotForDisplay =
    input.hasReadonlySnapshot
    && (
      shouldUseReadonlyProfileFallback
      || (
        input.isPersistenceDegraded
        && input.runtimeOfficialCount === 0
        && input.runtimeProviderCount === 0
      )
    );

  const actionsDisabled = !input.isAuthenticated;
  const runtimeUnavailable = input.isApiReachable === false;
  let stage: UserApiWorkbenchStage;

  if (!input.isAuthenticated) {
    stage = 'unauthenticated';
  } else if (shouldUseReadonlySnapshotForDisplay && runtimeUnavailable) {
    stage = 'readonly-fallback';
  } else if (isHydratingRuntimeUserApis) {
    stage = 'syncing';
  } else if (runtimeUnavailable && !shouldUseReadonlySnapshotForDisplay) {
    stage = 'local-api-unavailable';
  } else {
    stage = 'editable';
  }

  return {
    stage,
    isHydratingRuntimeUserApis,
    providerActionsDisabled: actionsDisabled,
    providerEditorReadOnly: actionsDisabled,
    shouldUseReadonlyProfileFallback,
    shouldUseReadonlySnapshotForDisplay,
    userApiActionsDisabled: actionsDisabled,
    userApiEditorDisabled: actionsDisabled,
  };
}
