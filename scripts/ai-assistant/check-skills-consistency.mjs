// 简体中文：校验 AI 助手 Skills 规约与已注册工具一致性的脚本 (Check Skills Consistency)
// 职责：通过 AST/正则分析获取 ToolRegistry 注册的所有工具，校验 Skills 手册与 Flow 文件的对齐情况

import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const TOOLS_DIR = path.join(ROOT_DIR, 'apps', 'web', 'src', 'features', 'ai-assistant-runtime', 'tools');
const SKILLS_DIR = path.join(ROOT_DIR, 'docs', 'ai-assistant');

// 1. 扫描所有的工具文件，通过正则匹配获取所有注册的工具名和别名
function getRegisteredTools() {
  const tools = new Set();
  
  if (!fs.existsSync(TOOLS_DIR)) {
    console.warn(`[一致性校验] 工具目录不存在: ${TOOLS_DIR}`);
    return tools;
  }

  const files = fs.readdirSync(TOOLS_DIR);
  for (const filename of files) {
    if (!filename.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(TOOLS_DIR, filename), 'utf-8');

    // 匹配 name: '...' 或 name: "..."
    const nameRegex = /name:\s*['"]([a-zA-Z0-9_.-]+)['"]/g;
    let match;
    while ((match = nameRegex.exec(content)) !== null) {
      tools.add(match[1]);
    }

    // 匹配 registerAlias('alias', 'target')
    const aliasRegex = /registerAlias\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g;
    while ((match = aliasRegex.exec(content)) !== null) {
      tools.add(match[1]);
    }
  }

  // 加上一些已知且必要的系统工具
  tools.add('fillApiKey');
  tools.add('optimizePromptLocally');
  return tools;
}

// 2. 扫描所有的 confirm / dangerous 权限工具
function getSensitiveTools() {
  const sensitiveTools = new Set();
  if (!fs.existsSync(TOOLS_DIR)) return sensitiveTools;

  const files = fs.readdirSync(TOOLS_DIR);
  for (const filename of files) {
    if (!filename.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(TOOLS_DIR, filename), 'utf-8');

    // 匹配包含 permission: 'confirm' 或 permission: 'dangerous' 的工具段落
    const toolBlockRegex = /\{[^}]*name:\s*['"]([a-zA-Z0-9_.-]+)['"][^}]*permission:\s*['"](confirm|dangerous)['"][^}]*\}/gs;
    let match;
    while ((match = toolBlockRegex.exec(content)) !== null) {
      sensitiveTools.add(match[1]);
    }
  }
  return sensitiveTools;
}

// 3. 读取 Skills 手册并解析引用的工具名，支持递归扫描 skills.md 及 skills/*.md 文件
function getReferencedToolsInSkills() {
  const referenced = new Set();
  const filesToScan = [];

  const skillsFilePath = path.join(SKILLS_DIR, 'skills.md');
  if (fs.existsSync(skillsFilePath)) {
    filesToScan.push(skillsFilePath);
  }

  const subSkillsDir = path.join(SKILLS_DIR, 'skills');
  if (fs.existsSync(subSkillsDir)) {
    try {
      const files = fs.readdirSync(subSkillsDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          filesToScan.push(path.join(subSkillsDir, file));
        }
      }
    } catch (e) {
      console.warn(`[一致性校验] 读取 skills 目录失败:`, e.message);
    }
  }

  if (filesToScan.length === 0) {
    console.warn(`[一致性校验] 警告：未找到 skills.md 文档及 skills 目录下的 markdown 文件。`);
    return referenced;
  }

  const toolNameRegex = /`([a-zA-Z0-9_.-]+)`/g;
  for (const filePath of filesToScan) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      let match;
      while ((match = toolNameRegex.exec(content)) !== null) {
        referenced.add(match[1]);
      }
    } catch (e) {
      console.warn(`[一致性校验] 读取文件失败: ${filePath}`, e.message);
    }
  }
  return referenced;
}

function run() {
  console.log('[一致性校验] 开始校验 Agent Skills 手册与注册工具一致性...');

  const registered = getRegisteredTools();
  const sensitive = getSensitiveTools();
  const referenced = getReferencedToolsInSkills();

  console.log(`[一致性校验] 运行时注册的工具: [${Array.from(registered).join(', ')}]`);
  console.log(`[一致性校验] 敏感风险操作工具: [${Array.from(sensitive).join(', ')}]`);
  console.log(`[一致性校验] skills.md 中引用的工具: [${Array.from(referenced).join(', ')}]`);

  let failed = false;

  // 1. 校验：Skills 中引用的工具名必须真实存在于注册表中
  const validNamespaces = new Set(['canvas', 'ui', 'assets', 'generation', 'prompt', 'knowledge', 'skills']);
  for (const tool of referenced) {
    const parts = tool.split('.');
    const isNamespacedTool = parts.length === 2 && validNamespaces.has(parts[0]);
    if (isNamespacedTool || registered.has(tool)) {
      if (!registered.has(tool)) {
        console.error(`❌ [一致性校验错误] Skills 规约中引用了未注册的工具: \`${tool}\``);
        failed = true;
      }
    }
  }

  // 2. 校验：每一个 confirm 或 dangerous 工具都必须有 Skill 规约提及
  for (const tool of sensitive) {
    // 允许 alias 别名被提及即可
    if (!referenced.has(tool)) {
      // 检查别名
      let aliasMatched = false;
      if (tool === 'startBatchGeneration' && referenced.has('generation.createBatchJob')) aliasMatched = true;
      if (tool === 'startGeneration' && referenced.has('generation.start')) aliasMatched = true;
      if (tool === 'zipOutputs' && referenced.has('assets.zipOriginals')) aliasMatched = true;

      if (!aliasMatched) {
        console.error(`❌ [一致性校验错误] 敏感操作工具 \`${tool}\` 没有在 Skills 规约中被说明说明如何运行与防护。`);
        failed = true;
      }
    }
  }

  if (failed) {
    console.error('❌ [一致性校验] 校验失败。请修复上述规约不一致问题。');
    process.exit(1);
  } else {
    console.log('✅ [一致性校验] 校验成功！所有 Skills 规约与注册工具完全对齐。');
    process.exit(0);
  }
}

run();
