import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath) {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

test("App shell surface state is extracted into a dedicated hook", () => {
  const appSource = readSource("src/App.tsx");
  const hookSource = readSource("src/hooks/useWorkspaceSurface.ts");

  assert.match(appSource, /import \{ useWorkspaceSurface \} from '\.\/hooks\/useWorkspaceSurface';/);
  assert.doesNotMatch(appSource, /const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\);/);
  assert.doesNotMatch(appSource, /const activeAppSurface: AppSurface =/);
  assert.match(hookSource, /export function useWorkspaceSurface\(/);
  assert.match(hookSource, /const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\);/);
  assert.match(hookSource, /const focusWorkspace = useCallback\(\(\) => \{/);
  assert.match(hookSource, /const openLibrarySurface = useCallback\(\(\) => \{/);
  assert.match(hookSource, /const toggleChatPanel = useCallback\(\(\) => \{/);
  assert.match(hookSource, /const openProfileSurface = useCallback\(/);
  assert.match(hookSource, /const openSettingsSurface = useCallback\(/);
  assert.match(hookSource, /const handleSelectMobileTab = useCallback\(/);
});
