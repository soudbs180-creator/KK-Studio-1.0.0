import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const releaseManifest = JSON.parse(fs.readFileSync(path.join(root, "config", "release-manifest.json"), "utf8"));
const currentDisplayVersion = releaseManifest.displayVersion || `v${releaseManifest.version}`;

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

const files = {
  readme: "docs/README.md",
  rootGuide: "docs/PROJECT_ROOT_GUIDE.md",
  structure: "docs/PROJECT_STRUCTURE.md",
  handoff: "docs/development/session-handoff.md",
  agents: "AGENTS.md",
  assistantPlan: "AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md",
  plans: "plans.md",
  implement: "implement.md",
  status: "status.md",
  validation: "validation.md"
};

const aiAssistantDocs = {
  readme: "docs/ai-assistant/README.md",
  runbooks: "docs/ai-assistant/RUNBOOKS.md",
  moduleMap: "docs/ai-assistant/module-map.md",
  flowMap: "docs/ai-assistant/flow-map.md",
  toolRegistry: "docs/ai-assistant/tool-registry.md",
  canvasRuntimeState: "docs/ai-assistant/canvas-runtime-state.md",
  uiMap: "docs/ai-assistant/ui-map.md",
  skills: "docs/ai-assistant/skills.md",
  safetyPolicy: "docs/ai-assistant/safety-policy.md",
  sessionMemory: "docs/ai-assistant/session-memory.md"
};

for (const relativePath of [...Object.values(files), ...Object.values(aiAssistantDocs)]) {
  expectFile(relativePath);
}

const readme = exists(files.readme) ? read(files.readme) : "";
const rootGuide = exists(files.rootGuide) ? read(files.rootGuide) : "";
const structure = exists(files.structure) ? read(files.structure) : "";
const handoff = exists(files.handoff) ? read(files.handoff) : "";
const agents = exists(files.agents) ? read(files.agents) : "";
const assistantPlan = exists(files.assistantPlan) ? read(files.assistantPlan) : "";
const aiReadme = exists(aiAssistantDocs.readme) ? read(aiAssistantDocs.readme) : "";
const runbooks = exists(aiAssistantDocs.runbooks) ? read(aiAssistantDocs.runbooks) : "";
const moduleMap = exists(aiAssistantDocs.moduleMap) ? read(aiAssistantDocs.moduleMap) : "";
const flowMap = exists(aiAssistantDocs.flowMap) ? read(aiAssistantDocs.flowMap) : "";
const toolRegistry = exists(aiAssistantDocs.toolRegistry) ? read(aiAssistantDocs.toolRegistry) : "";
const canvasRuntimeState = exists(aiAssistantDocs.canvasRuntimeState) ? read(aiAssistantDocs.canvasRuntimeState) : "";
const uiMap = exists(aiAssistantDocs.uiMap) ? read(aiAssistantDocs.uiMap) : "";
const skills = exists(aiAssistantDocs.skills) ? read(aiAssistantDocs.skills) : "";
const safetyPolicy = exists(aiAssistantDocs.safetyPolicy) ? read(aiAssistantDocs.safetyPolicy) : "";
const sessionMemory = exists(aiAssistantDocs.sessionMemory) ? read(aiAssistantDocs.sessionMemory) : "";

expectIncludes(readme, files.readme, "Tech Layout & Runtime");
expectIncludes(rootGuide, files.rootGuide, "Runtime Layout");
expectIncludes(structure, files.structure, "## Runtime truth table");
expectIncludes(handoff, files.handoff, "AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md");
expectIncludes(agents, files.agents, "AGENTS.md - AI Agent 项目总指导文件");
expectIncludes(agents, files.agents, `KK Studio ${currentDisplayVersion}`);
expectIncludes(agents, files.agents, "AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md");
expectIncludes(agents, files.agents, "ToolRegistry");
expectIncludes(agents, files.agents, "CanvasRuntimeState");
expectIncludes(agents, files.agents, "config/release-manifest.json");
expectIncludes(assistantPlan, files.assistantPlan, "KK Studio");
expectIncludes(assistantPlan, files.assistantPlan, "ToolRegistry");
expectIncludes(assistantPlan, files.assistantPlan, "CanvasRuntimeState");
expectIncludes(assistantPlan, files.assistantPlan, "DurableGenerationQueue");
expectIncludes(aiReadme, aiAssistantDocs.readme, "KK Studio");
expectIncludes(moduleMap, aiAssistantDocs.moduleMap, "AI Takeover Module");
expectIncludes(flowMap, aiAssistantDocs.flowMap, "assets.zipOriginals");
expectIncludes(toolRegistry, aiAssistantDocs.toolRegistry, "generation.createBatchJob");
expectIncludes(canvasRuntimeState, aiAssistantDocs.canvasRuntimeState, "CanvasRuntimeState");
expectIncludes(uiMap, aiAssistantDocs.uiMap, "AI 接管");
expectIncludes(skills, aiAssistantDocs.skills, "download-selected-originals");
expectIncludes(safetyPolicy, aiAssistantDocs.safetyPolicy, "API Key");
expectIncludes(sessionMemory, aiAssistantDocs.sessionMemory, "session-handoff.md");

const requiredCurrentVersionDocs = [
  [aiAssistantDocs.readme, aiReadme, `KK Studio ${currentDisplayVersion}`],
  [aiAssistantDocs.runbooks, runbooks, `KK Studio ${currentDisplayVersion}`],
  [aiAssistantDocs.moduleMap, moduleMap, `KK Studio ${currentDisplayVersion}`],
  [aiAssistantDocs.flowMap, flowMap, `KK Studio ${currentDisplayVersion}`],
  [aiAssistantDocs.toolRegistry, toolRegistry, `KK Studio ${currentDisplayVersion}`],
  [aiAssistantDocs.canvasRuntimeState, canvasRuntimeState, `projectVersion: '${releaseManifest.version}'`],
  [aiAssistantDocs.uiMap, uiMap, `KK Studio ${currentDisplayVersion}`],
  [aiAssistantDocs.skills, skills, `KK Studio ${currentDisplayVersion}`],
  [aiAssistantDocs.safetyPolicy, safetyPolicy, `KK Studio ${currentDisplayVersion}`],
];

for (const [relativePath, content, token] of requiredCurrentVersionDocs) {
  expectIncludes(content, relativePath, token);
}

for (const [relativePath, content] of [
  [files.agents, agents],
  [files.readme, readme],
  [files.handoff, handoff],
]) {
  expectNoDuplicateHeadings(content, relativePath);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(`[agent-docs:check] 所有规范文档和根目录执行文档校验通过，当前版本 ${currentDisplayVersion}。`);
