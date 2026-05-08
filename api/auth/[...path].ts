import { proxyToVps } from '../_vpsProxy.ts';

export { config } from '../_vpsProxy.ts';

export default async function handler(request: Request) {
  const pathname = new URL(request.url).pathname.replace(/^\/api\/auth\/?/, '');
  return proxyToVps(request, `/api/auth/${pathname}`);
}
