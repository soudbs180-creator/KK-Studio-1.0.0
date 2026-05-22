export type UserApiWorkbenchStage =
  | 'unauthenticated'
  | 'local-api-unavailable'
  | 'readonly-fallback'
  | 'syncing'
  | 'editable';

export interface UserApiViewStateInput {
  hasReadonlySnapshot: boolean;
  hasSessionlessWorkbenchAccess?: boolean;
  isApiReachable?: boolean;
  isAuthenticated: boolean;
  isPersistenceDegraded: boolean;
  runtimeOfficialCount: number;
  runtimeProviderCount: number;
  sessionlessWorkbenchActionsEnabled?: boolean;
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
  const hasWorkbenchAccess =
    input.isAuthenticated
    || input.hasSessionlessWorkbenchAccess === true;
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

  const runtimeUnavailable = input.isApiReachable === false;
  const actionsDisabled =
    !input.isAuthenticated
    && (
      input.sessionlessWorkbenchActionsEnabled !== true
      || runtimeUnavailable
    );
  const sessionlessLocalDraftMode =
    !input.isAuthenticated
    && input.hasSessionlessWorkbenchAccess === true
    && input.sessionlessWorkbenchActionsEnabled === true
    && input.isApiReachable !== false;
  let stage: UserApiWorkbenchStage;

  if (!hasWorkbenchAccess) {
    stage = 'unauthenticated';
  } else if (shouldUseReadonlySnapshotForDisplay && runtimeUnavailable) {
    stage = 'readonly-fallback';
  } else if (isHydratingRuntimeUserApis) {
    stage = 'syncing';
  } else if (sessionlessLocalDraftMode) {
    stage = 'editable';
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
