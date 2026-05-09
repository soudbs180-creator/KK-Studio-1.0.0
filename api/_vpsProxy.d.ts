export const config: { runtime: 'edge' };

export function proxyToVps(request: Request, upstreamPath: string): Promise<Response>;
