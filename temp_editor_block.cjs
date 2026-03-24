const fs = require('fs');
const path = require('path');
const filePath = path.join('src', 'components', 'settings', 'ApiSettingsView.tsx');
const text = fs.readFileSync(filePath, 'utf8');
const start = text.indexOf('      {editorMode === null ? (');
const end = text.indexOf('      {editorMode === \'official\' ? (', start);
console.log(text.slice(start, end));
