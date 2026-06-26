let currentNetworkStatus: 'normal' | 'blocked' | 'unknown' = 'unknown';
let isVpnDetected = false;

/**
 * Probes connection to main overseas provider endpoints to discover blocked status.
 */
export async function probeNetwork(): Promise<'normal' | 'blocked'> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s quick timeout
    
    // We fetch a public endpoint with CORS enabled or handle the connection failure.
    // Even if CORS fails, a blocked network throws 'Failed to fetch' (TypeError), while a CORS block still means reachable DNS.
    // However, to be safe, we probe and catch network errors.
    await fetch('https://api.openai.com/v1/models', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    currentNetworkStatus = 'normal';
    isVpnDetected = true;
    return 'normal';
  } catch (err: any) {
    // If it aborted or failed to fetch, network is blocked/no VPN
    currentNetworkStatus = 'blocked';
    isVpnDetected = false;
    return 'blocked';
  }
}

export function getNetworkStatus(): 'normal' | 'blocked' | 'unknown' {
  return currentNetworkStatus;
}

export function isUserVpnEnabled(): boolean {
  return isVpnDetected;
}
