import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { cp, mkdir, rm, stat, writeFile } from 'fs/promises';

const rootDir = process.cwd();
const releaseRoot = path.join(rootDir, 'release', 'KK-Studio-Portable');
const runtimeDir = path.join(releaseRoot, 'runtime');
const appDir = path.join(releaseRoot, 'app');
const supportDir = path.join(releaseRoot, 'support');
const logsDir = path.join(releaseRoot, 'logs');
const runDir = path.join(releaseRoot, 'run');

const distSourceDir = path.join(rootDir, 'apps', 'web', 'dist');
const serverSourceDir = path.join(rootDir, 'services', 'api');
const serverTargetDir = path.join(appDir, 'server');
const includeServerEnv = process.argv.includes('--include-server-env')
  || process.env.KK_STUDIO_INCLUDE_SERVER_ENV === '1';
const releaseScriptSourceDir = path.join(rootDir, 'scripts', 'release');
const portableAppServerSource = path.join(releaseScriptSourceDir, 'portable-app-server.cjs');
const portableLaunchSource = path.join(releaseScriptSourceDir, 'portable-launch.ps1');
const portableStopSource = path.join(releaseScriptSourceDir, 'portable-stop.ps1');
const updateScriptSource = path.join(releaseScriptSourceDir, 'portable-self-update.ps1');
const portableRuntimeSourceClosures = [
  {
    source: path.join(rootDir, 'services', 'api'),
    target: serverTargetDir,
  },
  {
    source: path.join(rootDir, 'packages', 'api-client', 'src'),
    target: path.join(appDir, 'packages', 'api-client', 'src'),
  },
  {
    source: path.join(rootDir, 'packages', 'shared', 'src'),
    target: path.join(appDir, 'packages', 'shared', 'src'),
  },
];

function ensureExists(targetPath, message) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(message);
  }
}

function isLocalOrPrivateKkApiBaseUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return hostname === 'localhost'
      || hostname === '::1'
      || hostname === '0.0.0.0'
      || hostname.startsWith('127.')
      || hostname.startsWith('10.')
      || hostname.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
  } catch {
    return true;
  }
}

async function readBuiltKkApiBaseUrl(distDir) {
  const entries = await fs.promises.readdir(distDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(distDir, entry.name);
    if (entry.isDirectory()) {
      const nestedValue = await readBuiltKkApiBaseUrl(entryPath);
      if (nestedValue) {
        return nestedValue;
      }
      continue;
    }

    if (!/\.(?:html|js|mjs|json)$/i.test(entry.name)) {
      continue;
    }

    const source = await fs.promises.readFile(entryPath, 'utf8');
    const match = /VITE_KK_API_BASE_URL["']?\s*:\s*([`"'])(.*?)\1/.exec(source);
    if (match?.[2]) {
      return match[2];
    }
  }

  return '';
}

async function assertPortableRemoteKkApiBaseUrl(distDir) {
  const kkApiBaseUrl = await readBuiltKkApiBaseUrl(distDir);
  if (!kkApiBaseUrl || isLocalOrPrivateKkApiBaseUrl(kkApiBaseUrl)) {
    throw new Error(
      'Portable release does not package the core KK API. Set VITE_KK_API_BASE_URL to a remote VPS API before packaging.',
    );
  }

  return kkApiBaseUrl;
}

async function copyFile(sourcePath, targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { force: true });
}

async function copyDirectory(sourcePath, targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, {
    recursive: true,
    force: true,
  });
}

async function runCommand(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || rootDir,
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

async function ensureServerDependencies() {
  const serverTargetNodeModules = path.join(serverTargetDir, 'node_modules');
  const appNodeModules = path.join(appDir, 'node_modules');
  ensureExists(path.join(serverTargetDir, 'package-lock.json'), 'app/server/package-lock.json was not found.');

  const npmArgs = ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'];
  if (process.platform === 'win32') {
    await runCommand('cmd.exe', ['/d', '/s', '/c', `npm.cmd ${npmArgs.join(' ')}`], {
      cwd: serverTargetDir,
    });
  } else {
    await runCommand('npm', npmArgs, {
      cwd: serverTargetDir,
    });
  }
  await copyDirectory(serverTargetNodeModules, appNodeModules);
}

async function getDirectorySize(targetPath) {
  const targetStat = await stat(targetPath);
  if (targetStat.isFile()) {
    return targetStat.size;
  }

  const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    total += await getDirectorySize(path.join(targetPath, entry.name));
  }
  return total;
}

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function buildStartBat() {
  return [
    '@echo off',
    'setlocal',
    'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0support\\portable-launch.ps1"',
    'if errorlevel 1 (',
    '  echo.',
    '  echo Startup failed. Check the logs folder for details.',
    '  pause',
    ')',
    'endlocal',
    '',
  ].join('\r\n');
}

function buildStopBat() {
  return [
    '@echo off',
    'setlocal',
    'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0support\\portable-stop.ps1"',
    'if errorlevel 1 (',
    '  echo.',
    '  echo Stop command failed.',
    '  pause',
    ')',
    'endlocal',
    '',
  ].join('\r\n');
}

function buildReadme() {
  const serverEnvNote = includeServerEnv
    ? 'server/.env was included in this build.'
    : 'server/.env was intentionally not included. Local backend features that require secrets stay disabled until you add it manually.';

  return [
    'KK Studio Portable',
    '',
    'What is included',
    '- A prebuilt web app in app/dist',
    '- A bundled node.exe runtime',
    '- A local launcher that opens KK Studio at http://127.0.0.1:3000',
    '- The current server runtime files under app/server',
    '',
    'How to use',
    '1. Double-click "Start KK Studio.bat".',
    '2. Your browser opens the app automatically.',
    '3. Double-click "Stop KK Studio.bat" when you want to stop the local services.',
    '',
    'Workspace sync',
    '- When this bundle is launched from <project-root>/release/KK-Studio-Portable, it automatically syncs the latest workspace dist and portable support scripts before startup.',
    '- This avoids stale release files inside the repo from overriding newer source builds.',
    '',
    'Server env note',
    `- ${serverEnvNote}`,
    '- If you need local backend features that require secrets, place a valid .env file inside app/server/.',
    '',
    'Cloud deployment',
    '- This folder is only for portable local distribution.',
    '- Keep deploying the main project source with your existing VPS and hosted frontend setup.',
    '',
    'Optional self-update setup',
    '- Copy support/update-config.json.example to support/update-config.json.',
    '- Set manifestUrl to the hosted portable manifest.json produced by npm run publish:portable.',
    '- The launcher checks for updates before starting the local services.',
    '',
  ].join('\r\n');
}

function buildUpdateConfigExample() {
  return `${JSON.stringify({
    enabled: true,
    manifestUrl: 'https://example.com/kk-studio/portable/stable/manifest.json',
  }, null, 2)}\r\n`;
}

function buildAppPackageJson() {
  return `${JSON.stringify({
    private: true,
    type: 'module',
  }, null, 2)}\r\n`;
}

async function main() {
  ensureExists(distSourceDir, 'apps/web/dist/ was not found. Run npm run build first.');
  await assertPortableRemoteKkApiBaseUrl(distSourceDir);
  ensureExists(process.execPath, `node executable was not found: ${process.execPath}`);
  ensureExists(portableAppServerSource, 'scripts/release/portable-app-server.cjs was not found.');
  ensureExists(portableLaunchSource, 'scripts/release/portable-launch.ps1 was not found.');
  ensureExists(portableStopSource, 'scripts/release/portable-stop.ps1 was not found.');
  ensureExists(updateScriptSource, 'scripts/release/portable-self-update.ps1 was not found.');

  await rm(releaseRoot, { recursive: true, force: true });
  await mkdir(runtimeDir, { recursive: true });
  await mkdir(appDir, { recursive: true });
  await mkdir(supportDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });
  await mkdir(runDir, { recursive: true });

  await copyDirectory(distSourceDir, path.join(appDir, 'dist'));
  await copyFile(process.execPath, path.join(runtimeDir, process.platform === 'win32' ? 'node.exe' : 'node'));
  await copyFile(portableAppServerSource, path.join(appDir, 'portable-app-server.cjs'));
  await copyFile(portableLaunchSource, path.join(supportDir, 'portable-launch.ps1'));
  await copyFile(portableStopSource, path.join(supportDir, 'portable-stop.ps1'));
  await copyFile(updateScriptSource, path.join(supportDir, 'portable-self-update.ps1'));

  await writeFile(path.join(releaseRoot, 'Start KK Studio.bat'), buildStartBat(), 'utf8');
  await writeFile(path.join(releaseRoot, 'Stop KK Studio.bat'), buildStopBat(), 'utf8');
  await writeFile(path.join(releaseRoot, 'README-PORTABLE.txt'), buildReadme(), 'utf8');
  await writeFile(path.join(appDir, 'package.json'), buildAppPackageJson(), 'utf8');
  await writeFile(path.join(supportDir, 'update-config.json.example'), buildUpdateConfigExample(), 'utf8');

  for (const runtimeSource of portableRuntimeSourceClosures) {
    ensureExists(runtimeSource.source, `${path.relative(rootDir, runtimeSource.source)} was not found.`);
    const sourceStat = await stat(runtimeSource.source);
    if (sourceStat.isDirectory()) {
      await copyDirectory(runtimeSource.source, runtimeSource.target);
    } else {
      await copyFile(runtimeSource.source, runtimeSource.target);
    }
  }

  if (fs.existsSync(serverSourceDir)) {
    await copyDirectory(serverSourceDir, serverTargetDir);

    const targetNodeModules = path.join(serverTargetDir, 'node_modules');
    if (fs.existsSync(targetNodeModules)) {
      await rm(targetNodeModules, { recursive: true, force: true });
    }

    const targetEnv = path.join(serverTargetDir, '.env');
    if (fs.existsSync(targetEnv)) {
      await rm(targetEnv, { force: true });
    }

    if (includeServerEnv) {
      const serverEnvPath = path.join(serverSourceDir, '.env');
      if (fs.existsSync(serverEnvPath)) {
        await copyFile(serverEnvPath, targetEnv);
      }
    }

    await ensureServerDependencies();
  }

  const releaseSize = await getDirectorySize(releaseRoot);
  const summary = [
    '',
    `Portable package created: ${releaseRoot}`,
    `Portable package size: ${formatSize(releaseSize)}`,
    `Server env included: ${includeServerEnv ? 'yes' : 'no'}`,
  ].join('\n');

  process.stdout.write(`${summary}\n`);
}

main().catch(async (error) => {
  process.stderr.write(`Portable packaging failed: ${error.message}\n`);
  process.exitCode = 1;
});
