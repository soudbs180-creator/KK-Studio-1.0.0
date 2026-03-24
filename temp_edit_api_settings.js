const fs = require('node:fs');
const path = 'src/components/settings/ApiSettingsView.tsx';
let data;
try {
  data = fs.readFileSync(path, 'utf-8');
} catch (err) {
  console.error('read error', err);
  process.exit(1);
}
const marker = 'if (editorMode === null) {';
const start = data.indexOf(marker);
if (start === -1) {
  throw new Error('marker not found');
}
const retIndex = data.indexOf('  return (\n    <SettingsViewShell>', start);
if (retIndex === -1) {
  throw new Error('return block not found');
}
const officialMarker = "      {editorMode === 'official' ? (";
const officialStart = data.indexOf(officialMarker, retIndex);
if (officialStart === -1) {
  throw new Error('official block not found');
}
const thirdMarker = "      {editorMode === 'third-party' ? (";
const thirdStart = data.indexOf(thirdMarker, officialStart);
if (thirdStart === -1) {
  throw new Error('third-party block not found');
}
const returnEnd = data.lastIndexOf('  );');
if (returnEnd === -1) {
  throw new Error('return end not found');
}
const officialBlock = data.slice(officialStart, thirdStart);
const thirdBlock = data.slice(thirdStart, returnEnd);
const newBlock = `  return (
    <SettingsViewShell>
${officialBlock}

${thirdBlock}
    </SettingsViewShell>
  );
`;
const before = data.slice(0, retIndex);
const after = data.slice(returnEnd + '  );'.length);
const newData = before + newBlock + after;
fs.writeFileSync('temp_ApiSettingsView.tsx', newData);
