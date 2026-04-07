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

const files = {
  agentReadme: ".agent/README.md",
  umbrellaSkill: ".agent/rules/skills/SKILL.md",
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
const readme = exists(files.readme) ? read(files.readme) : "";
const rootGuide = exists(files.rootGuide) ? read(files.rootGuide) : "";
const structure = exists(files.structure) ? read(files.structure) : "";
const handoff = exists(files.handoff) ? read(files.handoff) : "";

expectIncludes(agentReadme, files.agentReadme, files.umbrellaSkill);
expectIncludes(agentReadme, files.agentReadme, "项目版本");
expectIncludes(umbrellaSkill, files.umbrellaSkill, "当前项目基线");
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

console.log("[agent-docs:check] agent and runtime-truth docs are aligned.");
