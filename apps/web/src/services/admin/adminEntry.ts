export function buildAdminLoginUrl(input: {
  configuredBaseUrl?: string;
  currentUrl?: string;
}): string {
  const configuredBaseUrl = String(input.configuredBaseUrl || '').trim().replace(/\/+$/, '');
  if (!configuredBaseUrl) {
    throw new Error('VITE_KK_ADMIN_URL must be configured for the admin redirect.');
  }

  const target = new URL(`${configuredBaseUrl}/login`);
  if (input.currentUrl) {
    target.searchParams.set('from', input.currentUrl);
  }

  return target.toString();
}
