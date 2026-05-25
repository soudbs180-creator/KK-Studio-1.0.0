import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type {
  ArrangeMode,
  CanvasContext,
  CanvasContextType,
  CanvasState,
  SubCardLayout,
} from '../../apps/web/src/context/canvasContextState.ts';

const ROOT_DIR = process.cwd();

type CanvasContextStatePublicBoundary = {
  state: CanvasState;
  context: CanvasContextType;
  contextObject: typeof CanvasContext;
  arrangeMode: ArrangeMode;
  subCardLayout: SubCardLayout;
};



test('CanvasContext delegates state model and defaults to a focused boundary module', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const stateSource = readSource('src/context/canvasContextState.ts');
  const testConfigSource = readSource('tsconfig.tests.json');
  const boundaryIsTypechecked: CanvasContextStatePublicBoundary | null = null;

  assert.equal(boundaryIsTypechecked, null);
  assert.match(testConfigSource, /tests\/unit\/canvas-context-state-boundary\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasContextState';/);
  assert.match(stateSource, /export interface CanvasState/);
  assert.match(stateSource, /export interface CanvasContextType/);
  assert.match(stateSource, /export const CanvasContext = createContext<CanvasContextType \| undefined>\(undefined\);/);
  assert.match(stateSource, /export const MAX_CANVASES = 10;/);
  assert.match(stateSource, /export const DEFAULT_STATE: CanvasState/);
  assert.doesNotMatch(stateSource, /syncCanvasCompatibility/);
  assert.doesNotMatch(contextSource, /interface CanvasState/);
  assert.doesNotMatch(contextSource, /interface CanvasContextType/);
  assert.doesNotMatch(contextSource, /LegacyInlineCanvas/);
  assert.doesNotMatch(contextSource, /LEGACY_INLINE_DEFAULT_/);
  assert.doesNotMatch(contextSource, /const DEFAULT_STATE: CanvasState =/);
  assert.doesNotMatch(contextSource, /createContext<CanvasContextType \| undefined>/);
  assert.match(contextSource, /useState<CanvasState>\(DEFAULT_STATE\)/);
  assert.match(contextSource, /setState\(\{\s*\.\.\.DEFAULT_STATE,\s*canvases: \[DEFAULT_CANVAS\],\s*activeCanvasId: DEFAULT_CANVAS\.id,\s*history: \{\}\s*\}\)/s);
  assert.doesNotMatch(contextSource, /subCardLayoutMode: 'row'/);
  assert.doesNotMatch(contextSource, /viewportCenter: \{ x: 0, y: 0 \}/);
});
