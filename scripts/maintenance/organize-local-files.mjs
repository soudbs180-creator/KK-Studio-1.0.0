import fs from 'fs';
import path from 'path';
import { cp, mkdir, readdir, rename, rm } from 'fs/promises';

const rootDir = process.cwd();
const workspaceDir = path.join(rootDir, 'workspace');
const dryRun = process.argv.includes('--dry-run');

const rules = [
  {
    name: 'codex temp artifacts',
    targetDir: path.join(workspaceDir, 'local-artifacts', 'codex-temp'),
    matches: (entryName) => /^\.codex-temp/i.test(entryName),
  },
  {
    name: 'codex backups',
    targetDir: path.join(workspaceDir, 'local-artifacts', 'codex-backups'),
    matches: (entryName) => /^\.codex-backups/i.test(entryName),
  },
  {
    name: 'root diagnostics screenshots',
    targetDir: path.join(workspaceDir, 'diagnostics', 'screenshots'),
    matches: (entryName) => /^modal-fix-test-.*\.png$/i.test(entryName) || /^settings-panel-current\.png$/i.test(entryName),
  },
  {
    name: 'root diagnostic patches',
    targetDir: path.join(workspaceDir, 'diagnostics', 'patches'),
    matches: (entryName) => /^(app-compare|canvas-compare)\.patch$/i.test(entryName),
  },
  {
    name: 'root typecheck dumps',
    targetDir: path.join(workspaceDir, 'diagnostics', 'typecheck'),
    matches: (entryName) => /^check-tc.*\.(json|js)$/i.test(entryName),
  },
];

const nestedBackupRoots = [
  'src',
  'docs',
  'scripts',
];

function isNestedBackupFile(entryName) {
  return /\.bak($|[._-])|\.backup$|~$|\.old$|\.orig$/i.test(entryName);
}

function createTimestampSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function moveEntry(sourcePath, targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });

  try {
    await rename(sourcePath, targetPath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EXDEV') {
      await cp(sourcePath, targetPath, { recursive: true, force: true });
      await rm(sourcePath, { recursive: true, force: true });
      return;
    }

    throw error;
  }
}

async function collectNestedBackupMoves(relativeDir = '') {
  const currentDir = path.join(rootDir, relativeDir);
  const entries = await readdir(currentDir, { withFileTypes: true });
  const moves = [];

  for (const entry of entries) {
    const entryRelativePath = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      moves.push(...await collectNestedBackupMoves(entryRelativePath));
      continue;
    }

    if (!isNestedBackupFile(entry.name)) {
      continue;
    }

    const targetPath = path.join(workspaceDir, 'local-artifacts', 'source-backups', entryRelativePath);
    moves.push({
      name: entryRelativePath,
      sourcePath: path.join(rootDir, entryRelativePath),
      targetPath,
      rule: 'nested source backup',
    });
  }

  return moves;
}

async function main() {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const plannedMoves = [];

  for (const entry of entries) {
    const rule = rules.find((candidate) => candidate.matches(entry.name));
    if (!rule) {
      continue;
    }

    const sourcePath = path.join(rootDir, entry.name);
    let targetPath = path.join(rule.targetDir, entry.name);

    if (fs.existsSync(targetPath)) {
      const parsed = path.parse(entry.name);
      targetPath = path.join(rule.targetDir, `${parsed.name}-${createTimestampSuffix()}${parsed.ext}`);
    }

    plannedMoves.push({
      name: entry.name,
      sourcePath,
      targetPath,
      rule: rule.name,
    });
  }

  for (const nestedRoot of nestedBackupRoots) {
    if (!fs.existsSync(path.join(rootDir, nestedRoot))) {
      continue;
    }

    plannedMoves.push(...await collectNestedBackupMoves(nestedRoot));
  }

  if (plannedMoves.length === 0) {
    process.stdout.write('No matching root-level temp artifacts were found.\n');
    return;
  }

  for (const move of plannedMoves) {
    process.stdout.write(`${dryRun ? '[dry-run] ' : ''}${move.name} -> ${path.relative(rootDir, move.targetPath)} (${move.rule})\n`);
    if (!dryRun) {
      await moveEntry(move.sourcePath, move.targetPath);
    }
  }

  process.stdout.write(`${dryRun ? 'Planned' : 'Moved'} ${plannedMoves.length} artifact(s).\n`);
}

main().catch((error) => {
  process.stderr.write(`Local organization failed: ${error.message}\n`);
  process.exitCode = 1;
});
