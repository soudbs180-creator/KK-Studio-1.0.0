import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



function readFileSystemCompatibilityBlock(): string {
  const source = readSource('src/services/storage/fileSystemService.ts');
  const start = source.indexOf('async createTagShortcut(');
  const end = source.indexOf('async migrateLegacyFiles(', start);
  assert.ok(start >= 0, 'createTagShortcut compatibility stub should remain');
  assert.ok(end > start, 'migrateLegacyFiles should remain after tag/settings compatibility stubs');
  return source.slice(start, end);
}

test('file-system tag shortcut compatibility stubs stay no-op and noUnused-clean', () => {
  const block = readFileSystemCompatibilityBlock();

  assert.match(block, /async createTagShortcut\(_handle: FileSystemDirectoryHandle, tag: string, filename: string, _isVideo: boolean = false\): Promise<void>/);
  assert.match(block, /async removeTagShortcut\(_handle: FileSystemDirectoryHandle, tag: string, filename: string, _isVideo: boolean = false\): Promise<void>/);
  assert.match(block, /async cleanupEmptyTagFolder\(_handle: FileSystemDirectoryHandle, tag: string, _isVideo: boolean = false\): Promise<void>/);
  assert.match(block, /async syncFileTagShortcuts\(_handle: FileSystemDirectoryHandle, filename: string, tags: string\[\], _isVideo: boolean = false\): Promise<void>/);
  assert.match(block, /async saveSettings\(_handle: FileSystemDirectoryHandle, settings: Record<string, any>\): Promise<void>/);
  assert.match(block, /async loadSettings\(_handle: FileSystemDirectoryHandle\): Promise<Record<string, any> \| null> \{\s*return null;\s*\}/);

  assert.doesNotMatch(block, /getDirectoryHandle\(/);
  assert.doesNotMatch(block, /createWritable\(/);
  assert.doesNotMatch(block, /removeEntry\(/);
});

test('App still calls tag shortcut compatibility stubs with the existing public signature', () => {
  const source = readSource('src/App.tsx');

  assert.match(source, /await fileSystemService\.createTagShortcut\(handle, tag, filename, isVideo\);/);
  assert.match(source, /await fileSystemService\.removeTagShortcut\(handle, tag, filename, isVideo\);/);
});
