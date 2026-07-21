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

const testFiles = parsedConfig.fileNames
  .filter((fileName) => fileName.split(/[\\/]/).includes("tests"))
  .sort();

const diagnostics = [...parsedConfig.errors];
const program = ts.createProgram({
  rootNames: parsedConfig.fileNames,
  options: parsedConfig.options,
});

diagnostics.push(...program.getOptionsDiagnostics());
diagnostics.push(...program.getGlobalDiagnostics());

for (const fileName of testFiles) {
  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    diagnostics.push({
      category: ts.DiagnosticCategory.Error,
      code: 0,
      file: undefined,
      start: undefined,
      length: undefined,
      messageText: `Unable to load test source file: ${fileName}`,
    });
    continue;
  }

  diagnostics.push(...program.getSyntacticDiagnostics(sourceFile));
  diagnostics.push(...program.getSemanticDiagnostics(sourceFile));
  diagnostics.push(...program.getDeclarationDiagnostics(sourceFile));
}

const relevantDiagnostics = diagnostics.filter((diagnostic) => {
  if (diagnostic.category !== ts.DiagnosticCategory.Error) {
    return false;
  }

  if (!diagnostic.file) {
    return true;
  }

  return diagnostic.file.fileName.split(/[\\/]/).includes("tests");
});

if (relevantDiagnostics.length > 0) {
  for (const diagnostic of relevantDiagnostics) {
    const formatted = ts.formatDiagnosticsWithColorAndContext([diagnostic], {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    });
    process.stderr.write(formatted);
  }
  process.exit(1);
}

console.log(`[tests:typecheck] semantic check passed for ${testFiles.length} test files using ${path.basename(configPath)}.`);
