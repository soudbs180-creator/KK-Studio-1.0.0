import { kkWebApiClient, shouldUseLegacyWebApiFallback } from '../api/kkApiClient.ts';
// Legacy contract test fallback: import { kkWebApiClient, shouldUseLegacyWebApiFallback } from '../api/kkApiClient';
import type { RuntimeAuthUser } from './runtimeAuthTypes.ts';

function localHashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function getLocalDefaultPresetAvatarId(seed?: string | null): string {
  const normalizedSeed = typeof seed === 'string' ? seed.trim() : '';
  const options = ['preset:peepy', 'preset:spark', 'preset:kitty', 'preset:blobcap', 'preset:arrowo', 'preset:cloudy'];
  if (!normalizedSeed) {
    return options[0];
  }
  const index = localHashSeed(normalizedSeed) % options.length;
  return options[index];
}

const TEMP_USER_STORAGE_KEY = 'temp_user_session_v1';
const TEMP_USER_EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface TempUserSession {
  user: RuntimeAuthUser;
  createdAt: number;
  expiresAt: number;
  isTempUser: true;
}

function buildTempEmail(tempUserId: string): string {
  return `${tempUserId}@temp.local`;
}

function buildTempNickname(tempUserId: string): string {
  return `Guest_${tempUserId.replace(/-/g, '').slice(0, 8)}`;
}

function generateTempUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `temp-${crypto.randomUUID()}`;
  }

  return `temp-${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildTempUser(input: {
  userId: string;
  email: string;
  nickname: string;
  createdAtIso: string;
}): RuntimeAuthUser {
  return {
    id: input.userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: input.email,
    phone: '',
    created_at: input.createdAtIso,
    updated_at: input.createdAtIso,
    confirmed_at: input.createdAtIso,
    last_sign_in_at: input.createdAtIso,
    app_metadata: {
      isTempUser: true,
      provider: 'temp',
    },
    user_metadata: {
      avatar_url: getLocalDefaultPresetAvatarId(input.userId),
      full_name: input.nickname,
      isTempUser: true,
    },
  };
}

class TempUserService {
  getCachedTempUser(): TempUserSession | null {
    try {
      const raw = localStorage.getItem(TEMP_USER_STORAGE_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw) as TempUserSession;
      if (!session?.expiresAt || Date.now() > session.expiresAt) {
        this.clearCachedTempUser();
        return null;
      }

      return session;
    } catch (error) {
      console.error('[TempUser] Failed to read cached temp user:', error);
      this.clearCachedTempUser();
      return null;
    }
  }

  private cacheTempUser(session: TempUserSession): void {
    try {
      localStorage.setItem(TEMP_USER_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('[TempUser] Failed to cache temp user:', error);
    }
  }

  clearCachedTempUser(): void {
    localStorage.removeItem(TEMP_USER_STORAGE_KEY);
  }

  private createLocalFallbackSession(reason: string): TempUserSession {
    const createdAt = Date.now();
    const expiresAt = createdAt + TEMP_USER_EXPIRY_MS;
    const userId = generateTempUserId();
    const createdAtIso = new Date(createdAt).toISOString();

    console.warn('[TempUser] Falling back to a local temp user session:', reason);

    const session: TempUserSession = {
      user: buildTempUser({
        userId,
        email: buildTempEmail(userId),
        nickname: buildTempNickname(userId),
        createdAtIso,
      }),
      createdAt,
      expiresAt,
      isTempUser: true,
    };

    this.cacheTempUser(session);
    return session;
  }

  async createTempUser(): Promise<TempUserSession> {
    try {
      const response = await kkWebApiClient.createTempUser();
      if (!response.success) {
        console.error('[TempUser] Failed to create temp user session via API:', response.error);
        const message = response.error.message || 'Failed to create guest session.';
        if (shouldUseLegacyWebApiFallback()) {
          return this.createLocalFallbackSession(message);
        }
        throw new Error(message);
      }

      const legacyCreatedAt = Date.parse(response.data.createdAt) || Date.now();
      const legacyExpiresAt = Date.parse(response.data.expiresAt) || legacyCreatedAt + TEMP_USER_EXPIRY_MS;
      const legacyEmail = response.data.email || buildTempEmail(response.data.userId);
      const legacyNickname = response.data.nickname || buildTempNickname(response.data.userId);
      const legacyCreatedAtIso = response.data.createdAt || new Date(legacyCreatedAt).toISOString();

      const session: TempUserSession = {
        user: buildTempUser({
          userId: response.data.userId,
          email: legacyEmail,
          nickname: legacyNickname,
          createdAtIso: legacyCreatedAtIso,
        }),
        createdAt: legacyCreatedAt,
        expiresAt: legacyExpiresAt,
        isTempUser: true,
      };

      this.cacheTempUser(session);
      return session;
    } catch (error) {
      console.error('[TempUser] Failed to create temp user session via API:', error);
      const message = error instanceof Error && error.message
        ? error.message
        : 'Failed to create guest session.';
      if (shouldUseLegacyWebApiFallback()) {
        return this.createLocalFallbackSession(message);
      }
      throw new Error(message);
    }
  }

  async getOrCreateTempUser(): Promise<TempUserSession> {
    const cached = this.getCachedTempUser();
    if (cached) return cached;
    return this.createTempUser();
  }

  isTempUser(user: RuntimeAuthUser | null): boolean {
    if (!user) return false;
    return user.user_metadata?.isTempUser === true || user.app_metadata?.isTempUser === true;
  }

  getTimeRemaining(session: TempUserSession | null): number {
    if (!session) return 0;
    return Math.max(0, session.expiresAt - Date.now());
  }

  formatTimeRemaining(session: TempUserSession | null): string {
    const remaining = this.getTimeRemaining(session);
    if (remaining <= 0) return 'Expired';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) return 'About 24 hours';
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}

export const tempUserService = new TempUserService();
