export const KKAI_FEATURE_FLAGS = {
  billing: true,
  admin: false,
  workspaceCloudSync: false,
  cloudProfileFallback: false,
} as const;

export function shouldEnableWorkspaceCloudSync(): boolean {
  return KKAI_FEATURE_FLAGS.workspaceCloudSync;
}
