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
  agentReadme: ".agent/README.md",
  umbrellaSkill: ".agent/rules/skills/SKILL.md",
  cadenceSkill: ".agent/rules/skills/cadence-skill/SKILL.md",
  vendorRoutingSkill: ".agent/rules/skills/vendor-routing/SKILL.md",
  readme: "README.md",
  rootGuide: "PROJECT_ROOT_GUIDE.md",
  structure: "docs/PROJECT_STRUCTURE.md",
  handoff: "docs/development/session-handoff.md",
};

for (const relativePath of Object.values(files)) {
  expectFile(relativePath);
}

const agentReadme = exists(files.agentReadme) ? read(files.agentReadme) : "";
const umbrellaSkill = exists(files.umbrellaSkill) ? read(files.umbrellaSkill) : "";
const cadenceSkill = exists(files.cadenceSkill) ? read(files.cadenceSkill) : "";
const vendorRoutingSkill = exists(files.vendorRoutingSkill) ? read(files.vendorRoutingSkill) : "";
const readme = exists(files.readme) ? read(files.readme) : "";
const rootGuide = exists(files.rootGuide) ? read(files.rootGuide) : "";
const structure = exists(files.structure) ? read(files.structure) : "";
const handoff = exists(files.handoff) ? read(files.handoff) : "";

expectIncludes(agentReadme, files.agentReadme, files.umbrellaSkill);
expectIncludes(agentReadme, files.agentReadme, files.cadenceSkill);
expectIncludes(agentReadme, files.agentReadme, files.vendorRoutingSkill);
expectIncludes(agentReadme, files.agentReadme, "项目版本");
expectIncludes(agentReadme, files.agentReadme, "## 规则拆分");

expectIncludes(umbrellaSkill, files.umbrellaSkill, "当前项目基线");
expectIncludes(umbrellaSkill, files.umbrellaSkill, files.cadenceSkill);
expectIncludes(umbrellaSkill, files.umbrellaSkill, files.vendorRoutingSkill);
expectIncludes(umbrellaSkill, files.umbrellaSkill, "Cadence SKILL 代码规范与严格要求");
expectIncludes(umbrellaSkill, files.umbrellaSkill, "供应商 API 路由规范");
expectIncludes(umbrellaSkill, files.umbrellaSkill, "## 📋 变更日志");

for (const [relativePath, content] of [
  [files.umbrellaSkill, umbrellaSkill],
  [files.cadenceSkill, cadenceSkill],
  [files.vendorRoutingSkill, vendorRoutingSkill],
]) {
  expectIncludes(content, relativePath, "---");
  expectIncludes(content, relativePath, "description:");
  expectIncludes(content, relativePath, "# ");
}

for (const token of [
  "## 常用模板库",
  "## 按任务类型输出模板",
  "## CIW 加载与运行",
  "## 模板使用原则",
]) {
  expectIncludes(cadenceSkill, files.cadenceSkill, token);
}

for (const token of [
  "## 总体路由规则",
  "## 实现文件映射",
  "## 常见改动入口",
  "## 12AI",
  "## GPT Best",
  "## New Suxi AI",
  "## 路由与回退规则",
  "## 禁止事项",
]) {
  expectIncludes(vendorRoutingSkill, files.vendorRoutingSkill, token);
}

expectNoDuplicateHeadings(cadenceSkill, files.cadenceSkill);
expectNoDuplicateHeadings(vendorRoutingSkill, files.vendorRoutingSkill);

const umbrellaVersion = extractVersionTuple(umbrellaSkill);
if (!umbrellaVersion.titleVersion) {
  fail(`${files.umbrellaSkill} is missing the title version marker`);
}
if (!umbrellaVersion.footerVersion) {
  fail(`${files.umbrellaSkill} is missing the footer version marker`);
}
if (
  umbrellaVersion.titleVersion
  && umbrellaVersion.footerVersion
  && umbrellaVersion.titleVersion !== umbrellaVersion.footerVersion
) {
  fail(
    `${files.umbrellaSkill} title/footer version mismatch: ${umbrellaVersion.titleVersion} vs ${umbrellaVersion.footerVersion}`,
  );
}
if (!umbrellaVersion.updatedDate) {
  fail(`${files.umbrellaSkill} is missing the Last updated marker`);
}
if (umbrellaVersion.updatedDate && !agentReadme.includes(umbrellaVersion.updatedDate)) {
  fail(`${files.agentReadme} does not mention umbrella Last updated date ${umbrellaVersion.updatedDate}`);
}

expectIncludes(readme, files.readme, "Current runtime truth");
expectIncludes(rootGuide, files.rootGuide, "Runtime truth first");
expectIncludes(structure, files.structure, "## Runtime truth table");
expectIncludes(handoff, files.handoff, "当前在线前端运行时");

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("[agent-docs:check] agent documentation and runtime-truth docs are aligned.");
