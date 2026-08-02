// 简体中文：扫描并构建项目知识库文档索引的 Node.js 脚本 (Build Knowledge Index)
// 职责：扫描 docs/ai-assistant/ 下的 markdown，生成 project-index.json

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT_DIR = process.cwd();
const DOCS_DIR = path.join(ROOT_DIR, 'docs', 'ai-assistant');
const OUTPUT_DIR = path.join(DOCS_DIR, 'generated');

// 辅助哈希生成
function getHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

// 提取 markdown 中的首个标题和前两句段落作为摘要
function parseMarkdown(filePath, content) {
  let title = path.basename(filePath, '.md');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  let summary = 'No summary available.';
  // 提取标题后的第一个段落
  const paragraphs = content
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0 && !p.startsWith('#') && !p.startsWith('>') && !p.startsWith('-'));
  
  if (paragraphs.length > 0) {
    summary = paragraphs[0].slice(0, 150);
  }

  return { title, summary };
}

function readExistingIndex(outputPath) {
  if (!fs.existsSync(outputPath)) {
    return new Map();
  }

  try {
    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    if (!Array.isArray(existing)) {
      return new Map();
    }
    return new Map(existing.map((document) => [document.id, document]));
  } catch {
    return new Map();
  }
}

function run() {
  console.log('[Knowledge Index] 开始构建项目知识库索引...');

  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, 'project-index.json');
  const existingDocuments = readExistingIndex(outputPath);
  const files = fs.readdirSync(DOCS_DIR);
  const documents = [];

  for (const filename of files) {
    const filePath = path.join(DOCS_DIR, filename);
    const stat = fs.statSync(filePath);
    
    if (stat.isFile() && filename.endsWith('.md')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { title, summary } = parseMarkdown(filePath, content);
      
      const id = 'doc_' + filename.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
      const contentHash = getHash(content);
      const existing = existingDocuments.get(id);
      const updatedAt = existing?.contentHash === contentHash && typeof existing.updatedAt === 'string'
        ? existing.updatedAt
        : stat.mtime.toISOString();
      
      documents.push({
        id,
        source: 'doc',
        path: relativePath,
        title,
        summary,
        contentHash,
        updatedAt
      });
    }
  }

  // 写入 output
  // Replace the index atomically so concurrent governance checks never read a
  // partially truncated JSON file.
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(documents, null, 2), 'utf-8');
    fs.renameSync(temporaryPath, outputPath);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath, { force: true });
    }
  }
  console.log(`[Knowledge Index] 构建成功，已生成索引文件: ${outputPath}`);
}

run();
