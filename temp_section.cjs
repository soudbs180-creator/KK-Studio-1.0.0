const fs = require('fs');
const path = require('path');
const filePath = path.join('src', 'components', 'settings', 'ApiSettingsView.tsx');
const text = fs.readFileSync(filePath, 'utf8');
const pattern = '      ' + '<' + 'SettingsSection';
const start = text.indexOf(pattern);
const end = text.indexOf('      {activeTab ===', start);
console.log(text.slice(start, end));
