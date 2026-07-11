import { existsSync } from 'node:fs';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

async function runProcessSpawnProbe() {
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const child = spawn('cmd.exe', ['/c', 'echo', 'spawn-probe'], { stdio: 'ignore' });

      const timeout = setTimeout(() => {
        try {
          child.kill();
        } catch {}
        finish({
          ok: false,
          reason: 'process-spawn-blocked-timeout',
        });
      }, 5000);

      child.on('error', (error) => {
        clearTimeout(timeout);
        finish({
          ok: false,
          reason: 'process-spawn-blocked',
          errorCode: error?.code || null,
          message: String(error?.message || error || ''),
        });
      });

      child.on('exit', (code, signal) => {
        clearTimeout(timeout);
        finish({
          ok: code === 0,
          reason: code === 0 ? 'process-spawn-ok' : 'process-spawn-nonzero-exit',
          exitCode: code,
          signal: signal || null,
        });
      });
    } catch (error) {
      finish({
        ok: false,
        reason: 'process-spawn-check-threw',
        message: String(error?.message || error || ''),
      });
    }
  });
}

async function resolveHeadlessShellPath() {
  const root = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!root || !existsSync(root)) {
    return null;
  }

  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('chromium_headless_shell-')) {
      continue;
    }

    const executablePath = path.join(
      root,
      entry.name,
      'chrome-headless-shell-win64',
      'chrome-headless-shell.exe',
    );

    if (existsSync(executablePath)) {
      return executablePath;
    }
  }

  return null;
}

async function resolveBrowserExecutablePath() {
  const headlessShell = await resolveHeadlessShellPath();
  if (headlessShell) return headlessShell;

  const candidates = [
    process.env.KK_BROWSER_EXECUTABLE,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

export async function runBrowserPreflight() {
  const spawnProbe = await runProcessSpawnProbe();
  if (!spawnProbe.ok) {
    return {
      executablePath: null,
      ...spawnProbe,
    };
  }

  const executablePath = await resolveBrowserExecutablePath();
  if (!executablePath) {
    return {
      ok: false,
      reason: 'browser-executable-not-found',
      executablePath: null,
    };
  }

  return await new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({
        executablePath,
        ...result,
      });
    };

    try {
      const child = spawn(executablePath, [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--dump-dom',
        'about:blank',
      ], { stdio: 'ignore' });

      const timeout = setTimeout(() => {
        try {
          child.kill();
        } catch {}
        finish({
          ok: false,
          reason: 'browser-preflight-timeout',
        });
      }, 5000);

      child.on('error', (error) => {
        clearTimeout(timeout);
        finish({
          ok: false,
          reason: 'browser-preflight-spawn-error',
          errorCode: error?.code || null,
          message: String(error?.message || error || ''),
        });
      });

      child.on('exit', (code, signal) => {
        clearTimeout(timeout);
        finish({
          ok: code === 0,
          reason: code === 0 ? 'browser-preflight-ok' : 'browser-preflight-nonzero-exit',
          exitCode: code,
          signal: signal || null,
        });
      });
    } catch (error) {
      finish({
        ok: false,
        reason: 'browser-preflight-threw',
        message: String(error?.message || error || ''),
      });
    }
  });
}
