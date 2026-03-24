const fs = require('fs');
const text = fs.readFileSync('src/components/settings/ApiSettingsView.tsx', 'utf8');
const start = text.indexOf('{editorMode === null ? (');
const end = text.indexOf('{editorMode === \'official\'', start);
if (start === -1 || end === -1) {
  throw new Error('markers missing');
}
console.log('start', start, 'end', end);
