export interface ServerAdminConfig {
  primaryAdminUserId?: string;
}

export interface ServerAdminConfigSummary {
  primaryAdminUserIdConfigured: boolean;
  blockers: string[];
}

export function resolveServerAdminConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerAdminConfig {
  const primaryAdminUserId = String(env.KK_PRIMARY_ADMIN_USER_ID || '').trim() || undefined;
  return {
    primaryAdminUserId,
  };
}

export function summarizeServerAdminConfig(
  config: ServerAdminConfig,
): ServerAdminConfigSummary {
  return {
    primaryAdminUserIdConfigured: Boolean(config.primaryAdminUserId),
    blockers: config.primaryAdminUserId ? [] : ['KK_PRIMARY_ADMIN_USER_ID_MISSING'],
  };
}
