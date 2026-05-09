import { proxyToVps } from './_vpsProxy.js';

export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const rewritePath = url.searchParams.get('__kk_path');
  if (rewritePath) {
    url.searchParams.delete('__kk_path');
    const suffix = rewritePath.replace(/^\/+/, '');
    const query = url.searchParams.toString();
    return proxyToVps(
      new Request(url.toString(), request),
      `/api/v1/${suffix}${query ? `?${query}` : ''}`,
    );
  }

  return proxyToVps(request, '/api/v1');
}
