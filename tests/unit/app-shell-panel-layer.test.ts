import { readSource } from '../support/workspacePaths.js';
﻿import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("App delegates workspace panels while keeping the assistant runtime mounted", () => {
  const workspacePageSource = readSource("apps/web/src/pages/Workspace/WorkspacePage.tsx");
  const layerSource = readSource("apps/web/src/components/workspace/WorkspaceSurfacePanels.tsx");
  const panelsSource = readSource("apps/web/src/components/workspace/WorkspacePanels.tsx");

  assert.match(workspacePageSource, /WorkspaceSurfacePanels/);
  assert.doesNotMatch(workspacePageSource, /<WorkspacePanels\s/);
  assert.match(layerSource, /export function WorkspaceSurfacePanels\(/);
  assert.doesNotMatch(layerSource, /import ChatSidebar from '\.\.\/layout\/ChatSidebar';/);
  assert.match(layerSource, /const ChatSidebar = lazyWithRetry\(\(\) => import\('\.\.\/layout\/ChatSidebar'\)\);/);
  assert.match(layerSource, /<WorkspacePanels\s/);
  assert.match(layerSource, /renderChatSidebar=\{\(\) => \(/);
  assert.match(layerSource, /renderLibraryPanel=\{\(\) => \(/);
  assert.match(layerSource, /<Suspense fallback=\{null\}>[\s\S]*<ChatSidebar/);
  assert.match(layerSource, /<ChatSidebar/);
  assert.match(layerSource, /<AssetLibraryPanel/);
  assert.match(panelsSource, /renderChatSidebar\?: \(\) => ReactNode;/);
  assert.match(panelsSource, /renderLibraryPanel\?: \(\) => ReactNode;/);
  assert.match(panelsSource, /\{renderChatSidebar\?\.\(\)\}/);
  assert.doesNotMatch(panelsSource, /activePanel === 'chat' \|\| !isMobile/);
  assert.doesNotMatch(panelsSource, /!isMobile && renderChatSidebar/);
  assert.match(panelsSource, /\{activeSurface === 'library' \? renderLibraryPanel\?\.\(\) : null\}/);
  assert.doesNotMatch(panelsSource, /chatSidebar\?: ReactNode;/);
  assert.doesNotMatch(panelsSource, /libraryPanel\?: ReactNode;/);
});
