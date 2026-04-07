import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

const root = process.cwd();
const configArg = process.argv[2] || "tsconfig.tests.json";
const configPath = path.resolve(root, configArg);

const configResult = ts.readConfigFile(configPath, ts.sys.readFile);
if (configResult.error) {
  throw new Error(ts.flattenDiagnosticMessageText(configResult.error.messageText, "\n"));
}

const parsedConfig = ts.parseJsonConfigFileContent(
  configResult.config,
  ts.sys,
  path.dirname(configPath),
  undefined,
  configPath,
);

const testFiles = ts.sys.readDirectory(
  root,
  [".ts"],
  configResult.config.exclude,
  ["tests"],
).sort();

const diagnostics = [];

for (const fileName of testFiles) {
  const source = fs.readFileSync(fileName, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: parsedConfig.options,
    fileName,
    reportDiagnostics: true,
  });

  for (const diagnostic of result.diagnostics || []) {
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      diagnostics.push(diagnostic);
    }
  }
}

if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics) {
    const formatted = ts.formatDiagnosticsWithColorAndContext([diagnostic], {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    });
    process.stderr.write(formatted);
  }
  process.exit(1);
}

console.log(`[tests:typecheck] transpile check passed for ${testFiles.length} test files using ${path.basename(configPath)}.`);
