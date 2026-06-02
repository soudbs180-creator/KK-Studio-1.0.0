import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'

const ROOT_DIR = process.cwd()



describe('local performance trace store contract', () => {
  test('local performance trace helper exports read, clear, and summarize APIs', () => {
    const source = readSource('apps/web/src/services/system/localPerformanceTrace.ts')

    assert.match(
      source,
      /export function readLocalPerformanceTraceRecords\(\): LocalPerformanceTraceRecord\[] \{/
    )
    assert.match(
      source,
      /export function clearLocalPerformanceTraceRecords\(\): void \{/
    )
    assert.match(
      source,
      /export function summarizeLocalPerformanceTraces\(\s*options: LocalPerformanceTraceSummaryOptions = \{\}\s*\): LocalPerformanceTraceSummaryEntry\[] \{/
    )
  })

  test('global __KK_PERF__ store exposes clear and summary helpers', () => {
    const source = readSource('apps/web/src/services/system/localPerformanceTrace.ts')

    assert.match(
      source,
      /store\.clear = clearLocalPerformanceTraceRecords;/
    )
    assert.match(
      source,
      /store\.summary = \(options\?: LocalPerformanceTraceSummaryOptions \| string\) => \(/
    )
    assert.match(
      source,
      /typeof options === 'string'/
    )
  })
})
