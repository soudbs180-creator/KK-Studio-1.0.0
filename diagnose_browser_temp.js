import { readdir, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ensureLocalViteServer, closeLocalViteServer } from './scripts/test/ensure-local-vite-server.mjs';

const REPO_ROOT = process.cwd();

function readPlaywrightCacheVersion(modulePath) {
  try {
    const packagePath = path.join(path.dirname(modulePath), '..', 'playwright-core', 'package.json');
    return JSON.parse(readFileSync(packagePath, 'utf8')).version || '';
  } catch {
    return '';
  }
}

function isStablePlaywrightVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(String(version || ''));
}

async function resolvePlaywrightModuleUrl() {
  const npxCacheRoot = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  if (!npxCacheRoot || !existsSync(npxCacheRoot)) {
    throw new Error('Playwright npx cache directory not found. Run `cmd /c npx playwright --version` once first.');
  }

  const cacheEntries = await readdir(npxCacheRoot, { withFileTypes: true });
  const candidates = [];

  for (const entry of cacheEntries) {
    if (!entry.isDirectory()) continue;
    const modulePath = path.join(npxCacheRoot, entry.name, 'node_modules', 'playwright', 'index.mjs');
    if (!existsSync(modulePath)) continue;
    const stats = await stat(modulePath);
    const version = readPlaywrightCacheVersion(modulePath);
    candidates.push({
      modulePath,
      mtimeMs: stats.mtimeMs,
      stable: isStablePlaywrightVersion(version),
      version,
    });
  }

  candidates.sort((left, right) => Number(right.stable) - Number(left.stable) || right.mtimeMs - left.mtimeMs);
  if (candidates.length === 0) {
    throw new Error('Playwright module was not found in the npx cache. Run `cmd /c npx playwright --version` once first.');
  }

  return `file:///${candidates[0].modulePath.replace(/\\/g, '/')}`;
}

async function run() {
  console.log('Starting Vite server...');
  const { server, url } = await ensureLocalViteServer({ root: REPO_ROOT, url: 'http://127.0.0.1:3000' });
  console.log(`Vite server started at ${url}`);

  const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
  const { chromium } = await import(playwrightModuleUrl);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', (err) => {
    console.error('🔴 PAGE EXCEPTION:', err.stack || err);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('🔴 BROWSER ERROR CONSOLE:', msg.text());
    } else {
      console.log('⚪ BROWSER LOG:', msg.text());
    }
  });

  await page.addInitScript(() => {
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const createdAtIso = new Date(now).toISOString();
    const tempUser = {
      id: 'smoke-temp-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'smoke-temp-user@temp.local',
      phone: '',
      created_at: createdAtIso,
      updated_at: createdAtIso,
      confirmed_at: createdAtIso,
      last_sign_in_at: createdAtIso,
      app_metadata: {
        isTempUser: true,
        provider: 'temp',
      },
      user_metadata: {
        avatar_url: 'preset-default-local',
        full_name: 'Smoke Temp User',
        isTempUser: true,
      },
    };

    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem('kk_theme', 'dark');
    window.localStorage.setItem('kk_language', 'zh-CN');
    window.localStorage.setItem('kk_studio_storage_mode', 'browser');
    window.localStorage.setItem('kk_tutorial_seen', 'true');
    window.localStorage.setItem('kk_has_logged_in', 'true');
    window.localStorage.setItem('temp_user_session_v1', JSON.stringify({
      user: tempUser,
      createdAt: now,
      expiresAt,
      isTempUser: true,
    }));
    window.localStorage.setItem('kkai.runtime.user-state.v1', JSON.stringify({
      user: tempUser,
      isTempUser: true,
      tempUserExpiry: expiresAt,
    }));
  });

  console.log('Navigating to page...');
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('Navigation completed.');
  } catch (err) {
    console.error('Navigation failed:', err.message);
  }

  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log('Closing browser and server...');
  await browser.close();
  await closeLocalViteServer(server);
}

run().catch(console.error);
