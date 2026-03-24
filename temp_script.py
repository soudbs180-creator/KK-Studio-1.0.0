from pathlib import Path
text=Path('src/components/settings/ApiSettingsView.tsx').read_text('utf-8')
try:
    start=text.index('      {editorMode === null ? (')
    end=text.index('      ) : null}', start)+len('      ) : null}')
    print(text[start:end])
except Exception as exc:
    import traceback
    traceback.print_exc()
