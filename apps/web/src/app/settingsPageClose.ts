export interface SettingsPageCloseContext {
  currentOrigin?: string;
  currentPathname?: string;
  referrer?: string;
}

export function shouldUseHistoryBackForSettingsClose(input: SettingsPageCloseContext): boolean {
  const currentOrigin = String(input.currentOrigin || '').trim();
  const currentPathname = String(input.currentPathname || '').trim() || '/settings';
  const referrer = String(input.referrer || '').trim();

  if (!currentOrigin || !referrer) {
    return false;
  }

  try {
    const referrerUrl = new URL(referrer);
    const referrerPathname = referrerUrl.pathname || '/';

    if (referrerUrl.origin !== currentOrigin) {
      return false;
    }

    if (referrerPathname === currentPathname) {
      return false;
    }

    if (referrerPathname.startsWith('/settings')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
