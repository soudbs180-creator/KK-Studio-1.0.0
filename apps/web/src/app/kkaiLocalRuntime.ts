export const KKAI_LOCAL_USER_ID = 'local-user';

export interface KkaiLocalRuntime {
  mode: 'local-only';
  userId: string;
  launchTarget: 'restore-last-workspace' | 'default-workspace';
  cloudReadsAllowed: false;
  cloudWritesAllowed: false;
  billingEnabled: true;
  adminEnabled: false;
}

export function createKkaiLocalRuntime(
  input: { hasStoredWorkspace: boolean },
): KkaiLocalRuntime {
  return {
    mode: 'local-only',
    userId: KKAI_LOCAL_USER_ID,
    launchTarget: input.hasStoredWorkspace ? 'restore-last-workspace' : 'default-workspace',
    cloudReadsAllowed: false,
    cloudWritesAllowed: false,
    billingEnabled: true,
    adminEnabled: false,
  };
}
