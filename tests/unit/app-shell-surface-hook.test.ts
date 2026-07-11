import { readSource } from '../support/workspacePaths.js';
﻿import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("App shell surface state is extracted into a dedicated hook", () => {
  const workspaceSource = readSource("apps/web/src/pages/Workspace/WorkspacePage.tsx");
  const hookSource = readSource("apps/web/src/hooks/useWorkspaceSurface.ts");

  assert.match(workspaceSource, /import \{ useWorkspaceSurface, type SettingsSurfaceView \} from '\.\.\/\.\.\/hooks\/useWorkspaceSurface';/);
  assert.match(workspaceSource, /resolveCanvasWorkspaceSurface/);
  assert.match(workspaceSource, /const \[responsiveViewport, setResponsiveViewport\] = useState/);
  assert.match(workspaceSource, /const isMobile = isCanvasWorkspaceResultFlow\(canvasWorkspaceSurface\);/);
  assert.doesNotMatch(workspaceSource, /const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\);/);
  assert.doesNotMatch(workspaceSource, /const activeAppSurface: AppSurface =/);
  assert.match(hookSource, /export function useWorkspaceSurface\(/);
  assert.match(hookSource, /resolveResponsiveSurface\(window\.innerWidth\)/);
  assert.match(hookSource, /isCompactResponsiveSurface\(responsiveSurface\)/);
  assert.match(hookSource, /const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\);/);
  assert.match(hookSource, /const focusWorkspace = useCallback\(\(\) => \{/);
  assert.match(hookSource, /const openLibrarySurface = useCallback\(\(\) => \{/);
  assert.match(hookSource, /const toggleChatPanel = useCallback\(\(\) => \{/);
  assert.match(hookSource, /const openProfileSurface = useCallback\(/);
  assert.match(hookSource, /const openSettingsSurface = useCallback\(/);
  assert.match(hookSource, /const handleSelectMobileTab = useCallback\(/);
});
