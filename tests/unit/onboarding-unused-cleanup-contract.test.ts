import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

test('AchievementToast does not reintroduce stale lucide imports', () => {
  const source = readSource('src/components/Onboarding/AchievementToast.tsx');

  assert.doesNotMatch(source, /import \{[^}]*\bStar\b[^}]*\} from 'lucide-react';/);
  assert.match(source, /import \{ Trophy, X, Sparkles \} from 'lucide-react';/);
});

test('Onboarding residual files do not retain compiler-proven unused locals', () => {
  const managerSource = readSource('src/components/Onboarding/OnboardingManager.tsx');
  const overlaySource = readSource('src/components/Onboarding/OnboardingOverlay.tsx');
  const progressSource = readSource('src/components/Onboarding/useOnboardingProgress.ts');

  assert.doesNotMatch(managerSource, /\bOnboardingProgress,\s*/);
  assert.doesNotMatch(managerSource, /const \{ progress, updateProgress, completeTask, skipOnboarding \} = useOnboardingProgress\(\);/);
  assert.doesNotMatch(managerSource, /onTaskClick=\{\(task\) => \{\}\}/);
  assert.match(managerSource, /const \{ progress, completeTask, skipOnboarding \} = useOnboardingProgress\(\);/);
  assert.match(managerSource, /onTaskClick=\{\(\) => \{\}\}/);

  assert.doesNotMatch(overlaySource, /import \{[^}]*\bChevronLeft\b[^}]*\} from 'lucide-react';/);
  assert.doesNotMatch(overlaySource, /import \{[^}]*\bKeyboard\b[^}]*\} from 'lucide-react';/);
  assert.match(overlaySource, /import \{ X, ChevronRight, Sparkles, MousePointer, Zap, Award \} from 'lucide-react';/);

  assert.doesNotMatch(progressSource, /function getTasksByPhase\(phase: OnboardingPhase\): OnboardingTask\[\]/);
  assert.match(progressSource, /function getTasksByPhase\(_phase: OnboardingPhase\): OnboardingTask\[\]/);
});
