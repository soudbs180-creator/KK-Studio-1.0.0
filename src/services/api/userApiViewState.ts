export interface UserApiViewStateInput {
  hasReadonlySnapshot: boolean;
  isApiReachable?: boolean;
  isAuthenticated: boolean;
  isPersistenceDegraded: boolean;
  runtimeOfficialCount: number;
  runtimeProviderCount: number;
}

export interface UserApiViewState {
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
    shouldUseReadonlyProfileFallback
    || (
      input.isPersistenceDegraded
      && input.runtimeOfficialCount === 0
      && input.runtimeProviderCount === 0
    );

  const actionsDisabled = !input.isAuthenticated;

  return {
    isHydratingRuntimeUserApis,
    providerActionsDisabled: actionsDisabled,
    providerEditorReadOnly: actionsDisabled,
    shouldUseReadonlyProfileFallback,
    shouldUseReadonlySnapshotForDisplay,
    userApiActionsDisabled: actionsDisabled,
    userApiEditorDisabled: actionsDisabled,
  };
}
