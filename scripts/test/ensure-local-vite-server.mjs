import { createServer as createViteServer } from 'vite';

async function isUrlReady(url) {
  try {
    const response = await fetch(url, { redirect: 'manual' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureLocalViteServer({
  root = process.cwd(),
  url = 'http://127.0.0.1:3000/',
} = {}) {
  if (await isUrlReady(url)) {
    return { server: null, started: false };
  }

  const server = await createViteServer({
    root,
    logLevel: 'error',
    configLoader: 'native',
    server: {
      host: '127.0.0.1',
      port: 3000,
      strictPort: true,
    },
  });

  await server.listen();
  return { server, started: true };
}
