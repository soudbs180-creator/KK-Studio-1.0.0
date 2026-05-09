import { proxyToVps } from './_vpsProxy.js';

export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  return proxyToVps(request, '/healthz');
}
