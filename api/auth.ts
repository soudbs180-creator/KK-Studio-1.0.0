import { proxyToVps } from './_vpsProxy.ts';

export { config } from './_vpsProxy.ts';

export default async function handler(request: Request) {
  return proxyToVps(request, '/api/auth');
}
