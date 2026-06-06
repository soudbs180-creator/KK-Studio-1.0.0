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
  assistantPlan: "AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md",
  plans: "plans.md",
  implement: "implement.md",
  status: "status.md",
  validation: "validation.md"
};

const aiAssistantDocs = {
  readme: "docs/ai-assistant/README.md",
  moduleMap: "docs/ai-assistant/module-map.md",
  flowMap: "docs/ai-assistant/flow-map.md",
  toolRegistry: "docs/ai-assistant/tool-registry.md",
  canvasRuntimeState: "docs/ai-assistant/canvas-runtime-state.md",
  uiMap: "docs/ai-assistant/ui-map.md",
  skills: "docs/ai-assistant/skills.md",
  safetyPolicy: "docs/ai-assistant/safety-policy.md",
  sessionMemory: "docs/ai-assistant/session-memory.md"
};

// 检查每个文件是否存在
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
const moduleMap = exists(aiAssistantDocs.moduleMap) ? read(aiAssistantDocs.moduleMap) : "";
const flowMap = exists(aiAssistantDocs.flowMap) ? read(aiAssistantDocs.flowMap) : "";
const toolRegistry = exists(aiAssistantDocs.toolRegistry) ? read(aiAssistantDocs.toolRegistry) : "";
const canvasRuntimeState = exists(aiAssistantDocs.canvasRuntimeState) ? read(aiAssistantDocs.canvasRuntimeState) : "";
const uiMap = exists(aiAssistantDocs.uiMap) ? read(aiAssistantDocs.uiMap) : "";
const skills = exists(aiAssistantDocs.skills) ? read(aiAssistantDocs.skills) : "";
const safetyPolicy = exists(aiAssistantDocs.safetyPolicy) ? read(aiAssistantDocs.safetyPolicy) : "";
const sessionMemory = exists(aiAssistantDocs.sessionMemory) ? read(aiAssistantDocs.sessionMemory) : "";

// 校验各个文件的关键标志，保证文档对齐
expectIncludes(readme, files.readme, "Tech Layout & Runtime");
expectIncludes(rootGuide, files.rootGuide, "Runtime Layout");
expectIncludes(structure, files.structure, "## Runtime truth table");
expectIncludes(handoff, files.handoff, "AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md");
expectIncludes(agents, files.agents, "AGENTS.md - AI Agent 项目总指导文件");
expectIncludes(agents, files.agents, "KK Studio v1.5.5");
expectIncludes(agents, files.agents, "AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md");
expectIncludes(agents, files.agents, "ToolRegistry");
expectIncludes(agents, files.agents, "CanvasRuntimeState");
expectIncludes(assistantPlan, files.assistantPlan, "KK Studio v1.5.5");
expectIncludes(assistantPlan, files.assistantPlan, "ToolRegistry");
expectIncludes(assistantPlan, files.assistantPlan, "CanvasRuntimeState");
expectIncludes(assistantPlan, files.assistantPlan, "DurableGenerationQueue");
expectIncludes(aiReadme, aiAssistantDocs.readme, "KK Studio v1.5.5");
expectIncludes(moduleMap, aiAssistantDocs.moduleMap, "AI Takeover Module");
expectIncludes(flowMap, aiAssistantDocs.flowMap, "assets.zipOriginals");
expectIncludes(toolRegistry, aiAssistantDocs.toolRegistry, "generation.createBatchJob");
expectIncludes(canvasRuntimeState, aiAssistantDocs.canvasRuntimeState, "CanvasRuntimeState");
expectIncludes(uiMap, aiAssistantDocs.uiMap, "AI 接管");
expectIncludes(skills, aiAssistantDocs.skills, "download-selected-originals");
expectIncludes(safetyPolicy, aiAssistantDocs.safetyPolicy, "API Key");
expectIncludes(sessionMemory, aiAssistantDocs.sessionMemory, "session-handoff.md");

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("[agent-docs:check] 所有规范文档和根目录执行文档校验通过，符合严格 AGENTS 路线。");

