import fs from 'fs';
import path from 'path';

const roots = [
  'src',
  'apps',
  'api',
  'billing',
  'config',
  'docs',
  'packages',
  'payment-server',
  'scripts',
  'server',
  'supabase',
  'tests',
  'vite.config.ts',
  'vercel.json',
];

const extensions = new Set([
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

const suspiciousTokens = [
  '閿?',
  '闁?',
  '妫?',
  '闁稿繑濞婂Λ?',
  '闂冨懎鐭曠划?',
  '缂傚啯鍨圭划鍫曟閺嶇虎鍤?',
  'API Key 闂€鐐靛У閺?',
  '闁炬儳顦伴弲銉︽媴閸℃鍤掗梻鍕姈缁?',
  '缂傚倸鎼惃?',
  '闁衡偓椤栨瑧甯?',
  '缂佸鍨伴崹搴ㄥ礂閸涱厸鍋?',
  '闁活潿鍔嶉崺?',
  '濞戞挸顑堝ù?',
  '濡澘瀚～?',
  '棣?',
  '皎眳?',
  '閴?',
  '閽跨媴绗?',
  '馃',
  '鉂',
  '鉁',
  '瑙ｆ瀽',
  '鐢诲竷',
  '鍥剧墖',
  '椤圭洰',
  '鏈湴',
  '鏂囨。',
  '鍔犺浇',
  '淇濆瓨',
  '鎭㈠',
  '纭繚',
  '鍚堝苟',
  '鏁版嵁',
  '榛樿',
  '缁熻',
  '璁板綍',
  '鏍囪',
  '鍖呭惈',
  '绗?',
  '璺?',
  '渚涘簲鍟',
  '鎵句笉鍒',
  '妫板嫮',
];

const suspiciousCharSet = new Set('瑙鏋鍥鐢纭鍚鏈椤娓鎭榛闄鍏鏃鍔鍒鍙鍐寮娌缁绗鍖馃鉁鉂渚妫');
const skipDirectories = new Set(['node_modules', 'dist', '.git', '.npm-cache', 'coverage', '.agent']);
const ignoreFiles = new Set([
  path.resolve(process.argv[1]),
  path.resolve('scripts/fix-garbled-chars.cjs'),
]);
const issues = [];

function shouldScan(filePath) {
  return extensions.has(path.extname(filePath));
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
  if (suspiciousTokens.some((token) => token && text.includes(token))) {
    return true;
  }

  const suspiciousCharCount = countSuspiciousChars(text);
  if (suspiciousCharCount >= 4) {
    return true;
  }

  if (text.includes('?') && suspiciousCharCount >= 1 && /[\u4e00-\u9fff]/u.test(text)) {
    return true;
  }

  return false;
}

function walk(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  if (ignoreFiles.has(path.resolve(targetPath))) return;

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      if (skipDirectories.has(entry.name)) {
        continue;
      }
      walk(path.join(targetPath, entry.name));
    }
    return;
  }

  if (!shouldScan(targetPath)) return;

  const content = fs.readFileSync(targetPath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (hasSuspiciousText(trimmed)) {
      issues.push(`${targetPath}:${index + 1}: ${trimmed}`);
    }
  });
}

for (const target of roots) {
  walk(path.resolve(target));
}

if (issues.length > 0) {
  console.error('发现可疑乱码，请检查以下位置:');
  for (const issue of issues) {
    console.error(issue);
  }
  process.exit(1);
}

console.log('编码巡检通过：未发现可疑乱码。');
