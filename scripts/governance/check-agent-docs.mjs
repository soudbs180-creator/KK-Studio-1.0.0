import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
  failures.push(`[agent-docs:check] ${message}`);
}

function expectFile(relativePath) {
  if (!exists(relativePath)) {
    fail(`Missing required file: ${relativePath}`);
    return false;
  }
  return true;
}

function expectIncludes(content, relativePath, token) {
  if (!content.includes(token)) {
    fail(`${relativePath} is missing required token: ${token}`);
  }
}

function findHeadings(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(##|###)\s+/.test(line));
}

function expectNoDuplicateHeadings(content, relativePath) {
  const seen = new Map();
  for (const heading of findHeadings(content)) {
    const count = seen.get(heading) || 0;
    seen.set(heading, count + 1);
  }

  for (const [heading, count] of seen.entries()) {
    if (count > 1) {
      fail(`${relativePath} has duplicate heading: ${heading}`);
    }
  }
}

function extractVersionTuple(content) {
  const titleMatch = content.match(/^# .* v(\d+\.\d+)/m);
  const footerMatch = content.match(/^\*\*.* v(\d+\.\d+)\*\*$/m);
  const dateMatch = content.match(/^Last updated:\s+(\d{4}-\d{2}-\d{2})$/m);

  return {
    titleVersion: titleMatch?.[1] || "",
    footerVersion: footerMatch?.[1] || "",
    updatedDate: dateMatch?.[1] || "",
  };
}

const files = {
  readme: "docs/README.md",
  rootGuide: "docs/PROJECT_ROOT_GUIDE.md",
  structure: "docs/PROJECT_STRUCTURE.md",
  handoff: "docs/development/session-handoff.md",
  agents: "AGENTS.md",
  plans: "plans.md",
  implement: "implement.md",
  status: "status.md",
  validation: "validation.md"
};

// 检查每个文件是否存在
for (const relativePath of Object.values(files)) {
  expectFile(relativePath);
}

const readme = exists(files.readme) ? read(files.readme) : "";
const rootGuide = exists(files.rootGuide) ? read(files.rootGuide) : "";
const structure = exists(files.structure) ? read(files.structure) : "";
const handoff = exists(files.handoff) ? read(files.handoff) : "";
const agents = exists(files.agents) ? read(files.agents) : "";

// 校验各个文件的关键标志，保证文档对齐
expectIncludes(readme, files.readme, "Tech Layout & Runtime");
expectIncludes(rootGuide, files.rootGuide, "Runtime Layout");
expectIncludes(structure, files.structure, "## Runtime truth table");
expectIncludes(handoff, files.handoff, "当前在线前端运行时");
expectIncludes(agents, files.agents, "AGENTS.md - AI Agent 项目总指导文件");

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("[agent-docs:check] 所有规范文档和根目录执行文档校验通过，符合严格 AGENTS 路线。");

