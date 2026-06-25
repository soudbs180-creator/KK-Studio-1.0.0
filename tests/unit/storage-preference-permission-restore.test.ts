import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

import { readSource } from '../support/workspacePaths.js';

const ROOT_DIR = process.cwd();
const STORAGE_PREFERENCE_PATH = path.join(ROOT_DIR, 'apps/web/src/services/storage/storagePreference.ts');
const STORAGE_PREFERENCE_SOURCE = readSource('apps/web/src/services/storage/storagePreference.ts');

type StoragePreferenceModule = {
  clearStoragePreferenceCache: () => void;
  getLocalFolderHandle: () => Promise<FileSystemDirectoryHandle | null>;
  restoreLocalFolderConnection: () => Promise<FileSystemDirectoryHandle | null>;
  setLocalFolderHandle: (handle: FileSystemDirectoryHandle) => Promise<boolean>;
};

function createFakeIndexedDB() {
  const values = new Map<string, unknown>();
  const store = {
    get(key: string) {
      const request = {} as IDBRequest & { result?: unknown };
      setTimeout(() => {
        request.result = values.get(key);
        request.onsuccess?.({ target: request } as unknown as Event);
      }, 0);
      return request;
    },
    put(value: { id: string }) {
      const request = {} as IDBRequest;
      setTimeout(() => {
        values.set(value.id, value);
        request.onsuccess?.({ target: request } as unknown as Event);
      }, 0);
      return request;
    },
  };
  const db = {
    createObjectStore: () => store,
    transaction: () => ({
      objectStore: () => store,
    }),
  };

  return {
    open: () => {
      const request = { result: db } as unknown as IDBOpenDBRequest;
      setTimeout(() => {
        request.onupgradeneeded?.({ target: request } as unknown as IDBVersionChangeEvent);
        request.onsuccess?.({ target: request } as unknown as Event);
      }, 0);
      return request;
    },
  };
}

function loadStoragePreference(): StoragePreferenceModule {
  const module = { exports: {} as Record<string, unknown> };
  const context = {
    console: {
      error: () => {},
      log: () => {},
      warn: () => {},
    },
    indexedDB: createFakeIndexedDB(),
    module,
    navigator: {
      userAgent: 'UnitTest Chrome Desktop',
    },
    setTimeout,
    window: {
      showDirectoryPicker: async () => null,
    },
    exports: module.exports,
    require: (specifier: string) => {
      if (specifier === './imageStorage.ts') {
        return {
          getAllImageIds: async () => [],
          getImage: async () => null,
          getImageMetadata: async () => null,
        };
      }

      if (specifier === '../system/notificationService.ts') {
        return {
          notify: {
            error: () => {},
            info: () => {},
            success: () => {},
            warning: () => {},
          },
        };
      }

      throw new Error(`Unexpected storagePreference dependency: ${specifier}`);
    },
  } as Record<string, unknown>;

  context.globalThis = context;

  const transpiled = ts.transpileModule(STORAGE_PREFERENCE_SOURCE, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: STORAGE_PREFERENCE_PATH,
  }).outputText;

  vm.runInNewContext(transpiled, context, {
    filename: STORAGE_PREFERENCE_PATH,
  });

  return module.exports as StoragePreferenceModule;
}

test('manual local-folder restore asks permission for a saved handle that is still promptable', async () => {
  const storagePreference = loadStoragePreference();
  let requestPermissionCount = 0;
  const handle = {
    name: 'KK Studio Local Workspace',
    queryPermission: async () => 'prompt',
    requestPermission: async () => {
      requestPermissionCount += 1;
      return 'granted';
    },
  } as unknown as FileSystemDirectoryHandle;

  assert.equal(await storagePreference.setLocalFolderHandle(handle), true);
  storagePreference.clearStoragePreferenceCache();

  assert.equal(await storagePreference.getLocalFolderHandle(), null);

  const restoredHandle = await storagePreference.restoreLocalFolderConnection();

  assert.equal(restoredHandle, handle);
  assert.equal(requestPermissionCount, 1);
});
