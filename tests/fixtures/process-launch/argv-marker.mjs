import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const markerArguments = process.argv.slice(2);
const outputFlagIndex = markerArguments.indexOf('--output');
const exitCodeFlagIndex = markerArguments.indexOf('--exit-code');

if (outputFlagIndex < 0 || !markerArguments[outputFlagIndex + 1]) {
  throw new Error('argv-marker.mjs requires --output <path>.');
}

const outputPath = markerArguments[outputFlagIndex + 1];
const payload = {
  scriptPath: fileURLToPath(import.meta.url),
  argv: markerArguments,
  cwd: process.cwd(),
};

writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

if (exitCodeFlagIndex >= 0) {
  const requestedExitCode = Number(markerArguments[exitCodeFlagIndex + 1]);
  if (!Number.isInteger(requestedExitCode)) {
    throw new Error('argv-marker.mjs requires an integer after --exit-code.');
  }
  process.exitCode = requestedExitCode;
}
