const REGISTERED_OPENCLI_HOSTS = [
  'amazon.cn',
  'amazon.com',
  'behance.net',
  'chatgpt.com',
  'gemini.google.com',
  'google.com',
  'google.com.hk',
  'xiaohongshu.com',
  'youtube.com',
  'zhihu.com',
] as const;

function matchesRegisteredHost(hostname: string): boolean {
  return REGISTERED_OPENCLI_HOSTS.some((registeredHost) => (
    hostname === registeredHost || hostname.endsWith(`.${registeredHost}`)
  ));
}

/** Browser automation is limited to registered public site adapters. */
export function assertRegisteredOpencliTarget(target: string): URL {
  const url = new URL(target);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('OpenCLI target must use HTTP or HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('OpenCLI target cannot contain embedded credentials.');
  }
  const hostname = url.hostname.toLowerCase();
  if (!matchesRegisteredHost(hostname)) {
    throw new Error(`OpenCLI target host is not registered: ${hostname}`);
  }
  return url;
}

export function assertSafeOpencliArgument(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 2048 || normalized.startsWith('-') || /[\r\n\0]/.test(normalized)) {
    throw new Error(`OpenCLI ${label} is invalid.`);
  }
  return normalized;
}
