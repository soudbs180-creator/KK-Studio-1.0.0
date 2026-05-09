import { proxyToVps } from './_vpsProxy.js';

export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  const pathname = new URL(request.url).pathname.replace(/^\/api\/?/, '');
  return proxyToVps(request, `/api/${pathname}`);
}
