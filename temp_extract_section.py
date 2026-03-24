from pathlib import Path
text = Path('src/components/settings/ApiSettingsView.tsx').read_text(encoding='utf-8')
pattern = '      ' + chr(60) + 'SettingsSection'
start = text.index(pattern)
end = text.index('      {activeTab ===', start)
print(text[start:end])
