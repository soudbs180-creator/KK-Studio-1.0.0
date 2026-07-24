import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const writeMode = process.argv.includes("--write");
const indexPath = "docs/governance/DOCUMENTATION_INDEX.md";
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "release",
  "temp",
]);

const normalizePath = (value) => value.split(path.sep).join("/");

function collectMarkdownFiles(directory = root) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(absolutePath));
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") continue;
    const relativePath = normalizePath(path.relative(root, absolutePath));
    if (relativePath === indexPath) continue;
    files.push(relativePath);
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

const historicalPath = (relativePath) => (
  relativePath.startsWith("docs/archive/")
  || relativePath === "docs/development/session-handoff.md"
  || relativePath.startsWith(".agents/")
  || relativePath.startsWith(".workbuddy/")
);

const pendingArchivePath = (relativePath) => (
  relativePath.startsWith("docs/reports/root-notes/")
  || relativePath.startsWith("docs/superpowers/specs/")
);

const explicitStatusMarker = (source) => {
  const header = source.slice(0, 800);
  const match = /(?:^|\n)Status:\s*(\S+)/i.exec(header);
  return match ? match[1].toLowerCase() : null;
};

const legacyPaymentRuntimeSegment = ["payment", "server"].join("-");

const forbiddenActivePatterns = [
  {
    label: "committed Supabase browser credential",
    pattern: /\b(?:sb_publishable|sb_secret|VITE_SUPABASE_(?:URL|ANON_KEY))\b/i,
  },
  {
    label: "committed default password",
    pattern: /\badmin123456\b|(?:default\s+password|默认密码)[^\n]{0,40}\b(?:123|password|changeme)\b/i,
  },
  {
    label: "obsolete glass-first UI direction",
    pattern: /\bGlassmorphism\b|磨砂玻璃态/i,
  },
  {
    label: "obsolete executable legacy runtime command",
    pattern: new RegExp(`(?:npm\\s+run\\s+admin:(?:dev|build|preview)|cd\\s+(?:apps\\/admin|apps\\/api|${legacyPaymentRuntimeSegment}))`, "i"),
  },
];

function findBrokenLinks(relativePath, source) {
  const broken = [];
  const baseDir = path.dirname(relativePath);
  const cleanSource = source.replace(/```[\s\S]*?```/g, "").replace(/`[^`\r\n]+`/g, "");
  // Match markdown links and bare relative paths that look like source files.
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(cleanSource)) !== null) {
    const link = match[2];
    if (!link || link.startsWith("http") || link.startsWith("#") || link.startsWith("mailto:")) continue;
    const target = link.split("#")[0];
    if (!target) continue;
    const resolved = normalizePath(
      path.resolve(root, path.isAbsolute(target) ? path.join(root, ".", target) : path.join(baseDir, target))
    );
    if (!fs.existsSync(resolved)) {
      broken.push(target);
    }
  }
  return broken;
}

function checkCapabilityEvidence(relativePath, source) {
  // Only check AI assistant skill/capability docs that claim to describe current behavior.
  if (!relativePath.startsWith("docs/ai-assistant/")) return [];
  const hasEvidence =
    /(?:Source evidence|Evidence|当前证据|Source|Implemented in|Source of truth):/i.test(source)
    || /\.[tj]sx?:\d+/i.test(source)
    || /`[a-zA-Z0-9_\/\-]+\.[tj]sx?`/i.test(source);
  if (hasEvidence) return [];
  // Roadmaps and historical docs are exempt.
  const status = explicitStatusMarker(source);
  if (status === "historical" || status === "history" || status === "proposed" || status === "reference") return [];
  return ["missing capability evidence (source path/line or status marker)"];
}

function classify(relativePath, source) {
  const status = explicitStatusMarker(source);
  if (status === "historical" || status === "history" || historicalPath(relativePath)) {
    return { status: "history", conflicts: [] };
  }
  if (status === "reference") {
    return { status: "reference", conflicts: [] };
  }
  if (status === "proposed" || status === "draft") {
    return { status: "proposed", conflicts: [] };
  }
  if (pendingArchivePath(relativePath)) {
    return { status: "pending-archive", conflicts: [] };
  }
  const conflicts = forbiddenActivePatterns
    .filter(({ pattern }) => pattern.test(source))
    .map(({ label }) => label);

  const brokenLinks = findBrokenLinks(relativePath, source);
  for (const target of brokenLinks) {
    conflicts.push(`broken link: ${target}`);
  }

  const evidenceConflicts = checkCapabilityEvidence(relativePath, source);
  conflicts.push(...evidenceConflicts);

  return {
    status: conflicts.length > 0 ? "conflict" : "current",
    conflicts,
  };
}

function renderSection(title, entries) {
  const lines = [`## ${title} (${entries.length})`, ""];
  if (entries.length === 0) return [...lines, "- None", ""];
  for (const entry of entries) {
    const suffix = entry.conflicts.length > 0
      ? ` - ${entry.conflicts.join("; ")}`
      : "";
    lines.push(`- \`${entry.path}\`${suffix}`);
  }
  lines.push("");
  return lines;
}

const markdownFiles = collectMarkdownFiles();
const entries = markdownFiles.map((relativePath) => {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  return { path: relativePath, ...classify(relativePath, source) };
});
const grouped = {
  current: entries.filter((entry) => entry.status === "current"),
  reference: entries.filter((entry) => entry.status === "reference"),
  proposed: entries.filter((entry) => entry.status === "proposed"),
  history: entries.filter((entry) => entry.status === "history"),
  conflict: entries.filter((entry) => entry.status === "conflict"),
  "pending-archive": entries.filter((entry) => entry.status === "pending-archive"),
};

const indexSource = [
  "# KK Studio Documentation Governance Index",
  "",
  "> Generated by `scripts/governance/check-documentation-governance.mjs --write`.",
  "> Do not edit the inventory by hand.",
  "",
  `Markdown sources inventoried (generated index excluded): **${entries.length}**.`,
  "",
  "Classification rules:",
  "",
  "- `current`: normative for the active v1.6.0 implementation; must be kept in sync with source.",
  "- `reference`: stable API/contract/spec reference; not the implementation source of truth but authoritative for its domain.",
  "- `proposed`: future plan, draft, or roadmap; not yet implemented.",
  "- `history`: archived material or chronological handoff evidence.",
  "- `conflict`: active material containing a prohibited stale/secret pattern or a broken link.",
  "- `pending-archive`: non-normative reports/specs retained until a dedicated archive move.",
  "",
  ...renderSection("Current", grouped.current),
  ...renderSection("Reference", grouped.reference),
  ...renderSection("Proposed", grouped.proposed),
  ...renderSection("History", grouped.history),
  ...renderSection("Conflict", grouped.conflict),
  ...renderSection("Pending Archive", grouped["pending-archive"]),
].join("\n");

const absoluteIndexPath = path.join(root, indexPath);
if (writeMode) {
  fs.mkdirSync(path.dirname(absoluteIndexPath), { recursive: true });
  fs.writeFileSync(absoluteIndexPath, indexSource, "utf8");
} else if (!fs.existsSync(absoluteIndexPath)) {
  console.error(`[documentation:check] Missing generated index: ${indexPath}. Run with --write.`);
  process.exit(1);
} else {
  const existing = fs.readFileSync(absoluteIndexPath, "utf8").replace(/\r\n/g, "\n");
  if (existing !== indexSource) {
    console.error(`[documentation:check] ${indexPath} is stale. Run the checker with --write.`);
    process.exit(1);
  }
}

if (grouped.conflict.length > 0) {
  for (const entry of grouped.conflict) {
    console.error(`[documentation:check] ${entry.path}: ${entry.conflicts.join("; ")}`);
  }
  process.exit(1);
}

console.log(
  `[documentation:check] ${entries.length} Markdown sources indexed; `
  + `${grouped.current.length} current, ${grouped.reference.length} reference, `
  + `${grouped.proposed.length} proposed, ${grouped.history.length} history, `
  + `${grouped["pending-archive"].length} pending archive, 0 conflicts.`
);
