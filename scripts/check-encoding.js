import fs from 'fs';
import path from 'path';

const scanRoots = [
  'src',
  'apps',
  'api',
  'billing',
  'config',
  'docs',
  '.agent',
  'packages',
  'payment-server',
  'scripts',
  'server',
  'supabase',
  'tests',
  'vite.config.ts',
  'vercel.json',
  'README.md',
  'PROJECT_ROOT_GUIDE.md',
  '.env.example',
  path.join('apps', 'api', '.env.local.example'),
];

const scanExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.html',
  '.css',
  '.yaml',
  '.yml',
]);

const suspiciousFragments = [
  '鏄竴娆',
  '鍙戠幇',
  '缂栫爜',
  '璇峰',
  '淇濆瓨',
  '鏆傛椂',
  '妫€娴',
  '褰撳墠',
  '瀹樻柟',
  '绗笁鏂',
  '鎺ュ彛',
  '鍒锋柊',
  '娴忚鍣',
  '鐢ㄤ簬鎵胯浇',
  'SUPABASE_SERVICE_ROLE_KEY=浣犵殑',
];

const suspiciousCharSet = new Set('鍙闂妫璇淇鏂褰缂閹鏆閲棰渚涘簲鍐娴瀹閫绗鐢浣');
const skipDirectories = new Set([
  'node_modules',
  'dist',
  '.git',
  '.npm-cache',
  'coverage',
  '.agent',
  '.agents',
  '.kk-local',
  '.tmp-playwright',
  'release',
  'workspace',
]);
const ignoreFiles = new Set([
  path.resolve(process.argv[1]),
  path.resolve('scripts/fix-garbled-chars.cjs'),
]);
const issues = [];

function shouldScan(filePath) {
  if (ignoreFiles.has(path.resolve(filePath))) {
    return false;
  }

  return scanExtensions.has(path.extname(filePath)) || path.basename(filePath).startsWith('.env');
}

function countSuspiciousChars(text) {
  let count = 0;
  for (const char of text) {
    if (suspiciousCharSet.has(char)) {
      count += 1;
    }
  }
  return count;
}

function hasSuspiciousText(text) {
  if (
    text.startsWith('//')
    || text.startsWith('/*')
    || text.startsWith('*')
    || text.startsWith('*/')
  ) {
    return false;
  }

  if (text.includes('pick(') || text.includes('suspiciousLocaleCharSet')) {
    return false;
  }

  if (suspiciousFragments.some((fragment) => text.includes(fragment))) {
    return true;
  }

  const suspiciousCharCount = countSuspiciousChars(text);
  if (suspiciousCharCount >= 2) {
    return true;
  }

  if (text.includes('?') && suspiciousCharCount >= 1 && /[\u4e00-\u9fff]/u.test(text)) {
    return true;
  }

  return false;
}

function walk(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const resolvedPath = path.resolve(targetPath);
  if (ignoreFiles.has(resolvedPath)) {
    return;
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(resolvedPath, { withFileTypes: true })) {
      if (skipDirectories.has(entry.name)) {
        continue;
      }

      walk(path.join(resolvedPath, entry.name));
    }
    return;
  }

  if (!shouldScan(resolvedPath)) {
    return;
  }

  const content = fs.readFileSync(resolvedPath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    if (hasSuspiciousText(trimmed)) {
      issues.push(`${resolvedPath}:${index + 1}: ${trimmed}`);
    }
  });
}

for (const target of scanRoots) {
  walk(path.resolve(target));
}

if (issues.length > 0) {
  console.error('Found suspicious mojibake text. Please review the following locations:');
  for (const issue of issues) {
    console.error(issue);
  }
  process.exit(1);
}

console.log('Encoding check passed: no suspicious mojibake text found.');
