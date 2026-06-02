import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('App passes reusable result actions into MobileWorkspaceSurface for preview, continue-create, redraw, download, and delete', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const appMobileWorkspaceSource = readSource('apps/web/src/app/AppMobileWorkspace.tsx');

  assert.match(appSource, /const handleMobileUseImageAsSource = useCallback/);
  assert.match(appSource, /const handleRedrawRequest = useCallback/);
  assert.match(appSource, /const handleMobileResultRedraw = useCallback/);
  assert.match(appSource, /const handleOpenPreview = useCallback/);
  assert.match(appSource, /<AppMobileWorkspace/);
  assert.match(appSource, /surface=\{responsiveSurface\}/);
  assert.match(appSource, /onPreviewImage=\{handleOpenPreview\}/);
  assert.match(appSource, /onUseResultAsSource=\{handleMobileUseImageAsSource\}/);
  assert.match(appSource, /onPartialRedraw=\{handleMobileResultRedraw\}/);
  assert.match(appSource, /onDeleteImage=\{deleteImageNode\}/);
  assert.match(appMobileWorkspaceSource, /<MobileWorkspaceSurface/);
  assert.match(appMobileWorkspaceSource, /surface=\{surface\}/);
  assert.match(appMobileWorkspaceSource, /onPreviewImage=\{onPreviewImage\}/);
  assert.match(appMobileWorkspaceSource, /onUseResultAsSource=\{onUseResultAsSource\}/);
  assert.match(appMobileWorkspaceSource, /onPartialRedraw=\{onPartialRedraw\}/);
  assert.match(appMobileWorkspaceSource, /onDeleteImage=\{onDeleteImage\}/);
});
