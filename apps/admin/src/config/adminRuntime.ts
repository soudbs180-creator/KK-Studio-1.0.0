function trimUrl(value: string | undefined): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function resolveAdminAppBaseUrl(input: {
  configuredAdminUrl?: string;
  runtimeOrigin?: string;
}): string {
  const configured = trimUrl(input.configuredAdminUrl);
  if (configured) {
    return configured;
  }

  const runtimeOrigin = trimUrl(input.runtimeOrigin);
  return runtimeOrigin || 'http://127.0.0.1:4174';
}

export function resolveAdminApiBaseUrl(input: {
  configuredApiUrl?: string;
  adminAppBaseUrl: string;
}): string {
  const configured = trimUrl(input.configuredApiUrl);
  return configured || trimUrl(input.adminAppBaseUrl);
}
