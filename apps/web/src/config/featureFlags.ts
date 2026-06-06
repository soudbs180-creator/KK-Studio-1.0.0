export const featureFlags = {
  experimentalWorkflowGraph: true,
  experimentalWorkflowHighRiskNodes: false,
} as const;

export type FeatureFlagName = keyof typeof featureFlags;

export const isFeatureEnabled = (flag: FeatureFlagName): boolean =>
  featureFlags[flag];
