import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ProjectManager keeps mobile prompt props declared without destructuring unused values', () => {
  const projectManagerSource = readSource('src/components/settings/ProjectManager.tsx');
  const testConfigSource = readSource('tsconfig.tests.json');
  const propsStart = projectManagerSource.indexOf('interface ProjectManagerProps');
  const componentStart = projectManagerSource.indexOf('const ProjectManager: React.FC<ProjectManagerProps> = ({');
  const componentEnd = projectManagerSource.indexOf('}) => {', componentStart);

  assert.match(testConfigSource, /tests\/unit\/project-manager-unused-cleanup-contract\.test\.ts/);
  assert.notEqual(propsStart, -1);
  assert.notEqual(componentStart, -1);
  assert.notEqual(componentEnd, -1);

  const propsSource = projectManagerSource.slice(propsStart, componentStart);
  const destructuredPropsSource = projectManagerSource.slice(componentStart, componentEnd);

  assert.match(propsSource, /mobilePromptOptimizationEnabled\?: boolean;/);
  assert.match(propsSource, /mobilePromptOptimizationSupported\?: boolean;/);
  assert.match(propsSource, /onToggleMobilePromptOptimization\?: \(\) => void;/);
  assert.match(propsSource, /onOpenMobilePromptLibrary\?: \(\) => void;/);

  assert.doesNotMatch(destructuredPropsSource, /\bmobilePromptOptimizationEnabled\b/);
  assert.doesNotMatch(destructuredPropsSource, /\bmobilePromptOptimizationSupported\b/);
  assert.doesNotMatch(destructuredPropsSource, /\bonToggleMobilePromptOptimization\b/);
  assert.doesNotMatch(destructuredPropsSource, /\bonOpenMobilePromptLibrary\b/);
});
