import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
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
  readme: ".agent/README.md",
  umbrella: ".agent/rules/skills/SKILL.md",
  cadence: ".agent/rules/skills/cadence-skill/SKILL.md",
  vendorRouting: ".agent/rules/skills/vendor-routing/SKILL.md",
};

for (const relativePath of Object.values(files)) {
  expectFile(relativePath);
}

const readme = exists(files.readme) ? read(files.readme) : "";
const umbrella = exists(files.umbrella) ? read(files.umbrella) : "";
const cadence = exists(files.cadence) ? read(files.cadence) : "";
const vendorRouting = exists(files.vendorRouting) ? read(files.vendorRouting) : "";

for (const [label, relativePath] of [
  ["umbrella skill", files.umbrella],
  ["cadence skill", files.cadence],
  ["vendor routing skill", files.vendorRouting],
]) {
  const content = relativePath === files.umbrella
    ? umbrella
    : relativePath === files.cadence
      ? cadence
      : vendorRouting;

  expectIncludes(content, relativePath, "---");
  expectIncludes(content, relativePath, "description:");
  expectIncludes(content, relativePath, "# ");
}

expectIncludes(readme, files.readme, files.umbrella);
expectIncludes(readme, files.readme, files.cadence);
expectIncludes(readme, files.readme, files.vendorRouting);
expectIncludes(readme, files.readme, "## 规则拆分");

expectIncludes(umbrella, files.umbrella, files.cadence);
expectIncludes(umbrella, files.umbrella, files.vendorRouting);
expectIncludes(umbrella, files.umbrella, "Cadence SKILL 代码规范与严格要求");
expectIncludes(umbrella, files.umbrella, "供应商 API 路由规范");
expectIncludes(umbrella, files.umbrella, "## 📋 变更日志");

for (const token of [
  "## 常用模板库",
  "## 按任务类型输出模板",
  "## CIW 加载与运行",
  "## 模板使用原则",
]) {
  expectIncludes(cadence, files.cadence, token);
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
  expectIncludes(vendorRouting, files.vendorRouting, token);
}

expectNoDuplicateHeadings(cadence, files.cadence);
expectNoDuplicateHeadings(vendorRouting, files.vendorRouting);

const umbrellaVersion = extractVersionTuple(umbrella);
if (!umbrellaVersion.titleVersion) {
  fail(`${files.umbrella} is missing the title version marker`);
}
if (!umbrellaVersion.footerVersion) {
  fail(`${files.umbrella} is missing the footer version marker`);
}
if (umbrellaVersion.titleVersion && umbrellaVersion.footerVersion && umbrellaVersion.titleVersion !== umbrellaVersion.footerVersion) {
  fail(`${files.umbrella} title/footer version mismatch: ${umbrellaVersion.titleVersion} vs ${umbrellaVersion.footerVersion}`);
}
if (!umbrellaVersion.updatedDate) {
  fail(`${files.umbrella} is missing the Last updated marker`);
}
if (umbrellaVersion.updatedDate && !readme.includes(umbrellaVersion.updatedDate)) {
  fail(`${files.readme} does not mention umbrella Last updated date ${umbrellaVersion.updatedDate}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("[agent-docs:check] .agent documentation structure is consistent.");
