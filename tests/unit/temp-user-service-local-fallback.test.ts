import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
//
import path from 'node:path';
import { afterEach, test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type TempUserEnvelope = {
  success: boolean;
  data?: {
    userId: string;
    email?: string;
    nickname?: string;
    createdAt?: string;
    expiresAt?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type TempUserSessionLike = {
  user: {
    id: string;
    email: string;
    app_metadata: {
      isTempUser?: boolean;
    };
    user_metadata: {
      full_name?: string;
      isTempUser?: boolean;
    };
  };
  createdAt: number;
  expiresAt: number;
  isTempUser: true;
};

type TempUserServiceLike = {
  clearCachedTempUser: () => void;
  createTempUser: () => Promise<TempUserSessionLike>;
  getCachedTempUser: () => TempUserSessionLike | null;
};

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const ROOT_DIR = process.cwd();
const TEMP_USER_STORAGE_KEY = 'temp_user_session_v1';
const TEMP_USER_SERVICE_PATH = path.join(ROOT_DIR, 'apps/web/src/services/auth/tempUserService.ts');
const TEMP_USER_SERVICE_SOURCE = readSource('apps/web/src/services/auth/tempUserService.ts');

function loadTempUserService(options: {
  createTempUser: () => Promise<TempUserEnvelope>;
  origin: string;
  storage?: MemoryStorage;
}): { storage: MemoryStorage; tempUserService: TempUserServiceLike } {
  const storage = options.storage ?? new MemoryStorage();
  const module = { exports: {} as Record<string, unknown> };
  const context = {
    console: {
      error: () => {},
      warn: () => {},
      log: () => {},
    },
    crypto: {
      randomUUID: () => 'local-temp-user-fixed',
    },
    Date,
    JSON,
    Math,
    localStorage: storage,
    location: {
      origin: options.origin,
    },
    module,
    exports: module.exports,
    require: (specifier: string) => {
      if (specifier === '../api/kkApiClient' || specifier === '../api/kkApiClient.ts') {
        return {
          kkWebApiClient: {
            createTempUser: options.createTempUser,
          },
          shouldUseLegacyWebApiFallback: () => options.origin.startsWith('http://127.0.0.1:3000') || options.origin.startsWith('http://localhost:3000'),
        };
      }

      if (specifier === '../../utils/presetAvatars') {
        return {
          getDefaultPresetAvatarId: (userId: string) => `preset-avatar:${userId}`,
        };
      }

      throw new Error(`Unexpected tempUserService dependency: ${specifier}`);
    },
  } as Record<string, unknown>;

  context.globalThis = context;

  const transpiled = ts.transpileModule(TEMP_USER_SERVICE_SOURCE, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: TEMP_USER_SERVICE_PATH,
  }).outputText;

  vm.runInNewContext(transpiled, context, {
    filename: TEMP_USER_SERVICE_PATH,
  });

  return {
    storage,
    tempUserService: module.exports.tempUserService as TempUserServiceLike,
  };
}

afterEach(() => {
  // Each test loads the module into its own VM context, so cleanup is only needed
  // inside that isolated storage.
});

test('tempUserService falls back to a local temp session on loopback runtimes when temp-user bootstrap is unavailable', async () => {
  const { storage, tempUserService } = loadTempUserService({
    origin: 'http://127.0.0.1:3000',
    createTempUser: async () => ({
      success: false,
      error: {
        code: 'HTTP_502',
        message: 'Bad Gateway',
      },
    }),
  });

  const session = await tempUserService.createTempUser();

  assert.equal(session.isTempUser, true);
  assert.equal(session.user.app_metadata.isTempUser, true);
  assert.equal(session.user.user_metadata.isTempUser, true);
  assert.match(session.user.email, /@temp\.local$/);
  assert.match(String(session.user.user_metadata.full_name || ''), /^Guest_/);
  assert.ok(session.expiresAt > session.createdAt);
  assert.equal(storage.getItem(TEMP_USER_STORAGE_KEY) === null, false);
  assert.equal(tempUserService.getCachedTempUser()?.user.id, session.user.id);
});

test('tempUserService keeps hosted runtimes on the API-backed failure path when temp-user bootstrap is unavailable', async () => {
  const { storage, tempUserService } = loadTempUserService({
    origin: 'https://kk-studio.vercel.app',
    createTempUser: async () => ({
      success: false,
      error: {
        code: 'HTTP_502',
        message: 'Bad Gateway',
      },
    }),
  });

  await assert.rejects(
    () => tempUserService.createTempUser(),
    /Bad Gateway/,
  );
  assert.equal(storage.getItem(TEMP_USER_STORAGE_KEY), null);
  assert.equal(tempUserService.getCachedTempUser(), null);
});
