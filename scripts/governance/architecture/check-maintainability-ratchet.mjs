import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const DEFAULT_CONFIG_PATH = 'config/maintainability-ratchet.json';
const MAX_STRICT_FUNCTION_LINES = 50;
const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]s|tsx)$/i;
const METRIC_KEYS = ['maxLines', 'maxExplicitAny', 'maxConsoleLog'];

function parseArguments(argv) {
  const result = { configPath: DEFAULT_CONFIG_PATH, previousConfigPath: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--config') result.configPath = argv[index + 1] || '';
    if (argv[index] === '--previous-config') result.previousConfigPath = argv[index + 1] || '';
  }
  if (!result.configPath) throw new Error('--config requires a file path.');
  return result;
}

function readConfig(configPath) {
  const resolvedPath = path.resolve(configPath);
  const config = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  if (config.version !== 1 || !Array.isArray(config.hotspots) || !Array.isArray(config.strictPaths)) {
    throw new Error(`${configPath} must use maintainability ratchet schema version 1.`);
  }
  return config;
}

function getScriptKind(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.ts')) return ts.ScriptKind.TS;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function readFunctionName(node, sourceFile) {
  if (node.name) return node.name.getText(sourceFile);
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && parent.name) return parent.name.getText(sourceFile);
  return '<anonymous>';
}

function inspectSource(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, getScriptKind(filePath));
  const metrics = { lines: source.split(/\r?\n/).length, explicitAny: 0, consoleLog: 0, functions: [] };

  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) metrics.explicitAny += 1;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const isConsole = node.expression.expression.getText(sourceFile) === 'console';
      if (isConsole && node.expression.name.text === 'log') metrics.consoleLog += 1;
    }
    if (ts.isFunctionLike(node) && node.body) {
      const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
      const endLine = sourceFile.getLineAndCharacterOfPosition(node.end).line;
      metrics.functions.push({ name: readFunctionName(node, sourceFile), lines: endLine - startLine + 1 });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return metrics;
}

function listSourceFiles(targetPath) {
  const resolvedPath = path.resolve(targetPath);
  if (!fs.existsSync(resolvedPath)) return [];
  if (fs.statSync(resolvedPath).isFile()) return SOURCE_FILE_PATTERN.test(resolvedPath) ? [resolvedPath] : [];
  return fs.readdirSync(resolvedPath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = path.join(resolvedPath, entry.name);
    return entry.isDirectory() ? listSourceFiles(childPath) : SOURCE_FILE_PATTERN.test(entry.name) ? [childPath] : [];
  });
}

function validateHotspots(config, errors) {
  for (const baseline of config.hotspots) {
    const filePath = path.resolve(baseline.path);
    if (!fs.existsSync(filePath)) {
      errors.push(`${baseline.path}: hotspot file is missing; remove or lower its baseline in the same change.`);
      continue;
    }
    const metrics = inspectSource(filePath);
    const comparisons = [
      ['lines', metrics.lines, baseline.maxLines],
      ['explicit any', metrics.explicitAny, baseline.maxExplicitAny],
      ['console.log', metrics.consoleLog, baseline.maxConsoleLog],
    ];
    for (const [label, current, limit] of comparisons) {
      if (!Number.isInteger(limit) || limit < 0) errors.push(`${baseline.path}: invalid ${label} limit.`);
      else if (current > limit) errors.push(`${baseline.path}: ${label} ${current} exceeds limit ${limit}.`);
    }
    console.log(`[maintainability] ${baseline.path}: lines=${metrics.lines}, any=${metrics.explicitAny}, console.log=${metrics.consoleLog}`);
  }
}

function validateStrictPaths(config, errors) {
  const files = Array.from(new Set(config.strictPaths.flatMap(listSourceFiles)));
  for (const filePath of files) {
    const metrics = inspectSource(filePath);
    const displayPath = path.relative(process.cwd(), filePath) || filePath;
    if (metrics.explicitAny > 0) errors.push(`${displayPath}: strict module contains ${metrics.explicitAny} explicit any.`);
    if (metrics.consoleLog > 0) errors.push(`${displayPath}: strict module contains ${metrics.consoleLog} console.log calls.`);
    for (const fn of metrics.functions.filter((candidate) => candidate.lines > MAX_STRICT_FUNCTION_LINES)) {
      errors.push(`${displayPath}: function ${fn.name} exceeds 50 lines (${fn.lines}).`);
    }
  }
  console.log(`[maintainability] strict modules checked: ${files.length}`);
}

function validateBaselineDirection(config, previousConfig, errors) {
  if (!previousConfig) return;
  const previousByPath = new Map(previousConfig.hotspots.map((entry) => [entry.path, entry]));
  for (const current of config.hotspots) {
    const previous = previousByPath.get(current.path);
    if (!previous) continue;
    for (const key of METRIC_KEYS) {
      if (current[key] > previous[key]) {
        errors.push(`${current.path}: baseline ${key} cannot increase from ${previous[key]} to ${current[key]}.`);
      }
    }
  }
}

function readGitFile(revision, configPath) {
  const relativePath = path.relative(process.cwd(), path.resolve(configPath)).replaceAll('\\', '/');
  if (relativePath.startsWith('../')) return '';
  const result = spawnSync('git', ['show', `${revision}:${relativePath}`], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : '';
}

function loadPreviousConfig(configPath, explicitPreviousPath) {
  if (explicitPreviousPath) return readConfig(explicitPreviousPath);
  const currentText = fs.readFileSync(path.resolve(configPath), 'utf8');
  const headText = readGitFile('HEAD', configPath);
  const previousText = headText && headText !== currentText ? headText : readGitFile('HEAD^', configPath);
  return previousText ? JSON.parse(previousText) : null;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const config = readConfig(args.configPath);
  const previousConfig = loadPreviousConfig(args.configPath, args.previousConfigPath);
  const errors = [];
  validateBaselineDirection(config, previousConfig, errors);
  validateHotspots(config, errors);
  validateStrictPaths(config, errors);
  if (errors.length > 0) {
    for (const error of errors) console.error(`[maintainability] ${error}`);
    process.exit(1);
  }
  console.log('[maintainability] Ratchet passed; hotspot baselines did not grow.');
}

try {
  main();
} catch (error) {
  console.error(`[maintainability] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
