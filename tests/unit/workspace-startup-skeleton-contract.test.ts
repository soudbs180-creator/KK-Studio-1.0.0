import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'

const ROOT_DIR = process.cwd()



describe('workspace startup shell contract', () => {
  test('AuthenticatedAppShell keeps the real workspace visible and only uses the runtime banner during startup', () => {
    const shellSource = readSource('apps/web/src/app/AuthenticatedAppShell.tsx')

    assert.doesNotMatch(shellSource, /import \{ WorkspaceStartupSkeleton \} from '\.\.\/components\/common\/WorkspaceStartupSkeleton';/)
    assert.match(shellSource, /const \{[\s\S]*isBackgroundReady,[\s\S]*\} = useAppStartup\(\);/)
    assert.doesNotMatch(shellSource, /showWorkspaceStartupSkeleton/)
    assert.match(shellSource, /const showStartupRuntimeBanner = showStartupBanner && !isBackgroundReady;/)
    assert.match(shellSource, /\{showStartupRuntimeBanner \? <StartupRuntimeBanner \/> : null\}/)
    assert.doesNotMatch(shellSource, /<WorkspaceStartupSkeleton/)
  })

  test('startup runtime banner stays available with a stable test id and localized stage copy', () => {
    const shellSource = readSource('apps/web/src/app/AuthenticatedAppShell.tsx')

    assert.match(shellSource, /data-testid="startup-runtime-banner"/)
    assert.match(shellSource, /localizeUserFacingText|pickByDocumentLanguage/)
    assert.match(shellSource, /'Confirming your session\.\.\.'/)
    assert.match(shellSource, /'Workspace is ready\. Finishing background warm-up\.\.\.'/)
  })
})
