import fs from 'fs';
import path from 'path';
import { cp, mkdir, rm, stat, writeFile } from 'fs/promises';

const rootDir = process.cwd();
const releaseRoot = path.join(rootDir, 'release', 'KK-Studio-Portable');
const runtimeDir = path.join(releaseRoot, 'runtime');
const appDir = path.join(releaseRoot, 'app');
const supportDir = path.join(releaseRoot, 'support');
const logsDir = path.join(releaseRoot, 'logs');
const runDir = path.join(releaseRoot, 'run');

const distSourceDir = path.join(rootDir, 'dist');
const paymentSourceDir = path.join(rootDir, 'payment-server');
const paymentTargetDir = path.join(appDir, 'payment-server');
const includePaymentEnv = process.argv.includes('--include-payment-env') || process.env.KK_STUDIO_INCLUDE_PAYMENT_ENV === '1';

function ensureExists(targetPath, message) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(message);
  }
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
  const paymentNote = includePaymentEnv
    ? 'payment-server/.env was included in this build.'
    : 'payment-server/.env was intentionally not included. Local payment stays disabled until you add it manually.';

  return [
    'KK Studio Portable',
    '',
    'What is included',
    '- A prebuilt web app in app/dist',
    '- A bundled node.exe runtime',
    '- A local launcher that opens KK Studio at http://127.0.0.1:3000',
    '- Optional payment sidecar files if they existed at packaging time',
    '',
    'How to use',
    '1. Double-click "Start KK Studio.bat".',
    '2. Your browser opens the app automatically.',
    '3. Double-click "Stop KK Studio.bat" when you want to stop the local services.',
    '',
    'Payment note',
    `- ${paymentNote}`,
    '- If you need local payment, place a valid .env file inside app/payment-server/.',
    '',
    'Cloud deployment',
    '- This folder is only for portable local distribution.',
    '- Keep deploying the main project source with your existing Netlify or Vercel setup.',
    '',
  ].join('\r\n');
}

async function main() {
  ensureExists(distSourceDir, 'dist/ was not found. Run npm run build first.');
  ensureExists(process.execPath, `node executable was not found: ${process.execPath}`);
  ensureExists(path.join(rootDir, 'scripts', 'portable-app-server.cjs'), 'scripts/portable-app-server.cjs was not found.');
  ensureExists(path.join(rootDir, 'scripts', 'portable-launch.ps1'), 'scripts/portable-launch.ps1 was not found.');
  ensureExists(path.join(rootDir, 'scripts', 'portable-stop.ps1'), 'scripts/portable-stop.ps1 was not found.');

  await rm(releaseRoot, { recursive: true, force: true });
  await mkdir(runtimeDir, { recursive: true });
  await mkdir(appDir, { recursive: true });
  await mkdir(supportDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });
  await mkdir(runDir, { recursive: true });

  await copyDirectory(distSourceDir, path.join(appDir, 'dist'));
  await copyFile(process.execPath, path.join(runtimeDir, process.platform === 'win32' ? 'node.exe' : 'node'));
  await copyFile(path.join(rootDir, 'scripts', 'portable-app-server.cjs'), path.join(appDir, 'portable-app-server.cjs'));
  await copyFile(path.join(rootDir, 'scripts', 'portable-launch.ps1'), path.join(supportDir, 'portable-launch.ps1'));
  await copyFile(path.join(rootDir, 'scripts', 'portable-stop.ps1'), path.join(supportDir, 'portable-stop.ps1'));

  await writeFile(path.join(releaseRoot, 'Start KK Studio.bat'), buildStartBat(), 'utf8');
  await writeFile(path.join(releaseRoot, 'Stop KK Studio.bat'), buildStopBat(), 'utf8');
  await writeFile(path.join(releaseRoot, 'README-PORTABLE.txt'), buildReadme(), 'utf8');

  if (fs.existsSync(paymentSourceDir)) {
    const paymentFiles = [
      '.env.example',
      'index.js',
      'manual_recharge.js',
      'mcpClient.js',
      'package-lock.json',
      'package.json',
      'webhook.js',
    ];

    for (const relativeFile of paymentFiles) {
      const sourcePath = path.join(paymentSourceDir, relativeFile);
      if (fs.existsSync(sourcePath)) {
        await copyFile(sourcePath, path.join(paymentTargetDir, relativeFile));
      }
    }

    if (includePaymentEnv) {
      const paymentEnvPath = path.join(paymentSourceDir, '.env');
      if (fs.existsSync(paymentEnvPath)) {
        await copyFile(paymentEnvPath, path.join(paymentTargetDir, '.env'));
      }
    }

    const paymentNodeModules = path.join(paymentSourceDir, 'node_modules');
    if (fs.existsSync(paymentNodeModules)) {
      await copyDirectory(paymentNodeModules, path.join(paymentTargetDir, 'node_modules'));
    }
  }

  const releaseSize = await getDirectorySize(releaseRoot);
  const summary = [
    '',
    `Portable package created: ${releaseRoot}`,
    `Portable package size: ${formatSize(releaseSize)}`,
    `Payment env included: ${includePaymentEnv ? 'yes' : 'no'}`,
  ].join('\n');

  process.stdout.write(`${summary}\n`);
}

main().catch(async (error) => {
  process.stderr.write(`Portable packaging failed: ${error.message}\n`);
  process.exitCode = 1;
});
