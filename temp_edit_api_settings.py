from pathlib import Path
import sys

print('starting script')

try:
    path = Path('src/components/settings/ApiSettingsView.tsx')
    print('got path')
    data = path.read_text()
    print('read data')
    marker = "if (editorMode === null) {"
    start = data.index(marker)
    print('found marker at', start)
    ret = data.find("  return (\n    <SettingsViewShell>", start)
    print('found return at', ret)
    if ret == -1:
        raise RuntimeError('return block not found')
    official = "      {editorMode === 'official' ? ("
    official_start = data.find(official, ret)
    print('official start', official_start)
    if official_start == -1:
        raise RuntimeError('official block not found')
    third = "      {editorMode === 'third-party' ? ("
    third_start = data.find(third, official_start)
    print('third start', third_start)
    if third_start == -1:
        raise RuntimeError('third-party block not found')
    return_end = data.rfind("  );")
    print('return end', return_end)
    if return_end == -1:
        raise RuntimeError('return end not found')
    official_block = data[official_start:third_start]
    third_block = data[third_start:return_end]
    new_block = (
        "  return (\n"
        "    <SettingsViewShell>\n"
        f"{official_block}\n\n{third_block}\n"
        "    </SettingsViewShell>\n"
        "  );\n"
    )
    new_data = data[:ret] + new_block + data[return_end + len("  );") :]
    Path('temp_ApiSettingsView.tsx').write_text(new_data)
    print('wrote new file')
except Exception as exc:
    print('Error during script execution:', exc, file=sys.stderr)
    raise
