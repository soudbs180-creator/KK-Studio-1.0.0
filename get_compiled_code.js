import { ensureLocalViteServer, closeLocalViteServer } from './scripts/test/ensure-local-vite-server.mjs';

const REPO_ROOT = process.cwd();

async function run() {
  console.log('Starting Vite server...');
  const { server, url } = await ensureLocalViteServer({ root: REPO_ROOT, url: 'http://127.0.0.1:3000' });
  console.log(`Vite server started at ${url}`);

  try {
    const response = await fetch(`${url}/src/components/layout/PromptBar.tsx`);
    const code = await response.text();
    const lines = code.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('textColor')) {
        console.log(`--- Line ${idx+1} ---`);
        console.log(lines.slice(Math.max(0, idx-2), idx+3).join('\n'));
      }
    });
  } catch (err) {
    console.error('Fetch failed:', err);
  }

  await closeLocalViteServer(server);
}

run().catch(console.error);
