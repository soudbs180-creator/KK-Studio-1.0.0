import { createServer as createViteServer } from 'vite';

async function isUrlReady(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function ensureLocalViteServer({
  root = process.cwd(),
  url = 'http://127.0.0.1:3000/',
  fallbackPorts = [3001, 3002, 3003],
} = {}) {
  const requestedUrl = new URL(url);
  const requestedPort = Number(requestedUrl.port || (requestedUrl.protocol === 'https:' ? '443' : '80'));
  const candidatePorts = [requestedPort, ...fallbackPorts.filter((port) => port !== requestedPort)];

  if (await isUrlReady(url)) {
    return { server: null, started: false, url: requestedUrl.origin };
  }

  let lastError = null;

  for (const port of candidatePorts) {
    const candidateOrigin = `${requestedUrl.protocol}//${requestedUrl.hostname}:${port}`;

    if (port !== requestedPort && await isUrlReady(candidateOrigin)) {
      return { server: null, started: false, url: candidateOrigin };
    }

    try {
      const server = await createViteServer({
        root,
        logLevel: 'error',
        configLoader: 'native',
        server: {
          host: requestedUrl.hostname,
          port,
          strictPort: true,
        },
      });

      await server.listen();
      return { server, started: true, url: candidateOrigin };
    } catch (error) {
      if (/Port \d+ is already in use/i.test(String(error?.message || error))) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error(`No local Vite port is available for ${requestedUrl.origin}.`);
}

export async function closeLocalViteServer(server) {
  if (!server) {
    return;
  }

  if (typeof server.waitForRequestsIdle === 'function') {
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 5000);
      Promise.resolve(server.waitForRequestsIdle())
        .catch(() => {})
        .then(() => {
          clearTimeout(timeout);
          resolve();
        });
    });
  }

  await server.close();
}
