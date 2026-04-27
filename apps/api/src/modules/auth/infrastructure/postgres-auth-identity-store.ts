import { randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

import type {
  LoginResponseDto,
  ProfileDto,
  UpdateProfileRequestDto,
} from '../../../../../../packages/contracts/src/index.ts';
import {
  resolveAuthenticatedUserEmail,
  resolveAuthenticatedUserId,
  resolveAuthenticatedUserRole,
} from '../../../../../../packages/shared/src/index.ts';
import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from '../../../lib/postgres.ts';
import { createKkSessionToken, verifyKkSessionToken } from './kk-session-token.ts';

interface ProfileRow {
  id: string;
  email: string;
  nickname: string | null;
  avatar_url: string | null;
  role: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

interface PasswordIdentityRow extends ProfileRow {
  password_salt: string | null;
  password_hash: string | null;
  password_change_code_salt: string | null;
  password_change_code_hash: string | null;
  password_change_code_expires_at: string | null;
}

const sessionTtlSeconds = 60 * 60;
const refreshSessionTtlSeconds = sessionTtlSeconds * 24;
const passwordHashBytes = 64;
const passwordChangeCodeTtlMs = 15 * 60 * 1000;

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function createPasswordSecret(password: string): { passwordSalt: string; passwordHash: string } {
  const passwordSalt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(password, passwordSalt, passwordHashBytes).toString('hex');
  return {
    passwordSalt,
    passwordHash,
  };
}

function verifyPasswordSecret(password: string, passwordSalt: string, passwordHash: string): boolean {
  const expectedHash = Buffer.from(passwordHash, 'hex');
  const actualHash = scryptSync(password, passwordSalt, expectedHash.length);
  return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
}

function normalizeRole(role: string | null | undefined): 'user' | 'admin' {
  return role === 'admin' ? 'admin' : 'user';
}

function normalizeStatus(status: string | null | undefined): 'active' | 'suspended' {
  return status === 'suspended' ? 'suspended' : 'active';
}

function mapProfile(row: ProfileRow | undefined): ProfileDto | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    email: row.email,
    ...(row.nickname ? { nickname: row.nickname } : {}),
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
    role: normalizeRole(row.role),
    status: normalizeStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PostgresAuthIdentityStoreOptions {
  queryable: PostgresQueryable;
}

export class PostgresAuthIdentityStore {
  private readonly queryable: PostgresQueryable;

  constructor(options: PostgresAuthIdentityStoreOptions) {
    this.queryable = options.queryable;
  }

  async registerPasswordUser(email: string, password: string): Promise<{ created: boolean; profile: ProfileDto }> {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.findProfileByEmail(normalizedEmail);
    if (existing) {
      return {
        created: false,
        profile: existing,
      };
    }

    const now = new Date().toISOString();
    const userId = randomUUID();
    const nickname = normalizedEmail.split('@')[0] || 'user';
    const passwordSecret = createPasswordSecret(password);

    await this.queryable.query(
      `insert into profiles (
         id, email, nickname, avatar_url, role, status, user_apis, created_at, updated_at
       ) values (
         $1, $2, $3, $4, 'user', 'active', '[]'::jsonb, $5, $5
       )`,
      [userId, normalizedEmail, nickname, null, now],
    );
    await this.queryable.query(
      `insert into password_identities (
         user_id,
         password_salt,
         password_hash,
         password_changed_at,
         password_change_code_salt,
         password_change_code_hash,
         password_change_code_expires_at,
         created_at,
         updated_at
       ) values (
         $1, $2, $3, $4, null, null, null, $4, $4
       )`,
      [userId, passwordSecret.passwordSalt, passwordSecret.passwordHash, now],
    );

    return {
      created: true,
      profile: {
        id: userId,
        email: normalizedEmail,
        nickname,
        role: 'user',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  async authenticatePassword(email: string, password: string): Promise<LoginResponseDto | undefined> {
    const normalizedEmail = normalizeEmail(email);
    const row = await this.findPasswordIdentityByEmail(normalizedEmail);
    if (!row?.password_salt || !row.password_hash) {
      return undefined;
    }

    if (!verifyPasswordSecret(password, row.password_salt, row.password_hash)) {
      return undefined;
    }

    const profile = mapProfile(row);
    return profile ? this.issueLoginSessionForProfile(profile) : undefined;
  }

  async createRegisteredUser(email: string): Promise<{ created: boolean; profile: ProfileDto }> {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.findProfileByEmail(normalizedEmail);
    if (existing) {
      return {
        created: false,
        profile: existing,
      };
    }

    const now = new Date().toISOString();
    const profile: ProfileDto = {
      id: randomUUID(),
      email: normalizedEmail,
      nickname: normalizedEmail.split('@')[0] || 'user',
      role: 'user',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await this.insertOrUpdateProfile(profile);

    return {
      created: true,
      profile,
    };
  }

  async issueLoginSession(email: string): Promise<LoginResponseDto> {
    const { profile } = await this.createRegisteredUser(email);
    return this.issueLoginSessionForProfile(profile);
  }

  async issuePasswordChangeCode(
    userId: string,
  ): Promise<{ code: string; expiresAt: string; profile: ProfileDto } | undefined> {
    const row = await this.findPasswordIdentityByUserId(userId);
    const profile = mapProfile(row);
    if (!row?.password_salt || !row.password_hash || !profile) {
      return undefined;
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeSecret = createPasswordSecret(code);
    const expiresAt = new Date(Date.now() + passwordChangeCodeTtlMs).toISOString();

    await this.queryable.query(
      `update password_identities
          set password_change_code_salt = $2,
              password_change_code_hash = $3,
              password_change_code_expires_at = $4,
              updated_at = $5
        where user_id = $1`,
      [userId, codeSecret.passwordSalt, codeSecret.passwordHash, expiresAt, new Date().toISOString()],
    );

    return {
      code,
      expiresAt,
      profile,
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<ProfileDto | undefined> {
    const row = await this.findPasswordIdentityByUserId(userId);
    if (!row?.password_salt || !row.password_hash) {
      return undefined;
    }

    if (!verifyPasswordSecret(String(currentPassword || '').trim(), row.password_salt, row.password_hash)) {
      return undefined;
    }

    const passwordSecret = createPasswordSecret(newPassword);
    const now = new Date().toISOString();
    await this.queryable.query(
      `update password_identities
          set password_salt = $2,
              password_hash = $3,
              password_changed_at = $4,
              password_change_code_salt = null,
              password_change_code_hash = null,
              password_change_code_expires_at = null,
              updated_at = $4
        where user_id = $1`,
      [userId, passwordSecret.passwordSalt, passwordSecret.passwordHash, now],
    );

    return this.getProfileById(userId);
  }

  async changePasswordWithCode(
    userId: string,
    verificationCode: string,
    newPassword: string,
  ): Promise<ProfileDto | undefined> {
    const row = await this.findPasswordIdentityByUserId(userId);
    if (
      !row?.password_change_code_salt
      || !row.password_change_code_hash
      || !row.password_change_code_expires_at
    ) {
      return undefined;
    }

    const expiresAt = Date.parse(row.password_change_code_expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return undefined;
    }

    if (
      !verifyPasswordSecret(
        String(verificationCode || '').trim(),
        row.password_change_code_salt,
        row.password_change_code_hash,
      )
    ) {
      return undefined;
    }

    const passwordSecret = createPasswordSecret(newPassword);
    const now = new Date().toISOString();
    await this.queryable.query(
      `update password_identities
          set password_salt = $2,
              password_hash = $3,
              password_changed_at = $4,
              password_change_code_salt = null,
              password_change_code_hash = null,
              password_change_code_expires_at = null,
              updated_at = $4
        where user_id = $1`,
      [userId, passwordSecret.passwordSalt, passwordSecret.passwordHash, now],
    );

    return this.getProfileById(userId);
  }

  async resolveAccessToken(accessToken: string): Promise<ProfileDto | undefined> {
    const verifiedToken = verifyKkSessionToken(accessToken, { tokenType: 'access' });
    if (!verifiedToken) {
      return undefined;
    }

    const existing = await this.getProfileById(verifiedToken.userId);
    if (existing) {
      return existing;
    }

    if (!verifiedToken.email) {
      return undefined;
    }

    return this.upsertAuthenticatedProfile(
      verifiedToken.userId,
      verifiedToken.email,
      verifiedToken.role,
    );
  }

  async resolveProfile(headers: Record<string, string>): Promise<ProfileDto | undefined> {
    const authenticatedUserId = resolveAuthenticatedUserId(headers);
    if (authenticatedUserId) {
      return this.upsertAuthenticatedProfile(
        authenticatedUserId,
        resolveAuthenticatedUserEmail(headers),
        resolveAuthenticatedUserRole(headers),
      );
    }

    const authorization = String(headers.authorization || '').trim();
    if (!authorization) {
      return undefined;
    }

    const token = authorization.toLowerCase().startsWith('bearer ')
      ? authorization.slice(7).trim()
      : authorization;

    if (!token) {
      return undefined;
    }

    return this.resolveAccessToken(token);
  }

  async updateProfile(
    headers: Record<string, string>,
    input: UpdateProfileRequestDto,
  ): Promise<ProfileDto | undefined> {
    const profile = await this.resolveProfile(headers);
    if (!profile) {
      return undefined;
    }

    const now = new Date().toISOString();
    await this.queryable.query(
      `update profiles
          set nickname = coalesce($2, nickname),
              avatar_url = coalesce($3, avatar_url),
              updated_at = $4
        where id = $1`,
      [
        profile.id,
        typeof input.nickname === 'string' ? input.nickname.trim() || null : null,
        typeof input.avatarUrl === 'string' ? input.avatarUrl.trim() || null : null,
        now,
      ],
    );

    return this.getProfileById(profile.id);
  }

  async getProfileById(userId: string): Promise<ProfileDto | undefined> {
    const result = await this.queryable.query(
      `select id, email, nickname, avatar_url, role, status, created_at, updated_at
         from profiles
        where id = $1
        limit 1`,
      [String(userId || '').trim()],
    );
    return mapProfile(result.rows[0] as ProfileRow | undefined);
  }

  private issueLoginSessionForProfile(profile: ProfileDto): LoginResponseDto {
    return {
      accessToken: createKkSessionToken({
        tokenType: 'access',
        userId: profile.id,
        email: profile.email,
        role: profile.role,
        expiresInSeconds: sessionTtlSeconds,
      }),
      refreshToken: createKkSessionToken({
        tokenType: 'refresh',
        userId: profile.id,
        email: profile.email,
        role: profile.role,
        expiresInSeconds: refreshSessionTtlSeconds,
      }),
      expiresIn: sessionTtlSeconds,
      profile,
    };
  }

  private async findProfileByEmail(email: string): Promise<ProfileDto | undefined> {
    const result = await this.queryable.query(
      `select id, email, nickname, avatar_url, role, status, created_at, updated_at
         from profiles
        where lower(email) = lower($1)
        limit 1`,
      [email],
    );
    return mapProfile(result.rows[0] as ProfileRow | undefined);
  }

  private async findPasswordIdentityByEmail(email: string): Promise<PasswordIdentityRow | undefined> {
    const result = await this.queryable.query(
      `select p.id, p.email, p.nickname, p.avatar_url, p.role, p.status, p.created_at, p.updated_at,
              i.password_salt, i.password_hash, i.password_change_code_salt, i.password_change_code_hash, i.password_change_code_expires_at
         from profiles p
         join password_identities i on i.user_id = p.id
        where lower(p.email) = lower($1)
        limit 1`,
      [email],
    );
    return result.rows[0] as PasswordIdentityRow | undefined;
  }

  private async findPasswordIdentityByUserId(userId: string): Promise<PasswordIdentityRow | undefined> {
    const result = await this.queryable.query(
      `select p.id, p.email, p.nickname, p.avatar_url, p.role, p.status, p.created_at, p.updated_at,
              i.password_salt, i.password_hash, i.password_change_code_salt, i.password_change_code_hash, i.password_change_code_expires_at
         from profiles p
         join password_identities i on i.user_id = p.id
        where p.id = $1
        limit 1`,
      [String(userId || '').trim()],
    );
    return result.rows[0] as PasswordIdentityRow | undefined;
  }

  private async upsertAuthenticatedProfile(
    userId: string,
    email?: string,
    role?: string,
  ): Promise<ProfileDto | undefined> {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      return undefined;
    }

    const normalizedEmail = email
      ? normalizeEmail(email)
      : `${normalizedUserId}@local.invalid`;
    const normalizedRole = role === 'admin' ? 'admin' : 'user';
    const now = new Date().toISOString();

    await this.queryable.query(
      `insert into profiles (
         id,
         email,
         nickname,
         avatar_url,
         role,
         status,
         user_apis,
         created_at,
         updated_at
       ) values (
         $1, $2, $3, null, $4, 'active', '[]'::jsonb, $5, $5
       )
       on conflict (id) do update
         set email = excluded.email,
             role = excluded.role,
             updated_at = excluded.updated_at`,
      [normalizedUserId, normalizedEmail, normalizedEmail.split('@')[0] || 'user', normalizedRole, now],
    );

    return this.getProfileById(normalizedUserId);
  }

  private async insertOrUpdateProfile(profile: ProfileDto): Promise<void> {
    await this.queryable.query(
      `insert into profiles (
         id,
         email,
         nickname,
         avatar_url,
         role,
         status,
         user_apis,
         created_at,
         updated_at
       ) values (
         $1, $2, $3, $4, $5, $6, '[]'::jsonb, $7, $8
       )
       on conflict (id) do update
         set email = excluded.email,
             nickname = excluded.nickname,
             avatar_url = excluded.avatar_url,
             role = excluded.role,
             status = excluded.status,
             updated_at = excluded.updated_at`,
      [
        profile.id,
        profile.email,
        profile.nickname || null,
        profile.avatarUrl || null,
        profile.role,
        profile.status,
        profile.createdAt,
        profile.updatedAt,
      ],
    );
  }
}

export function createPostgresAuthIdentityStoreFromEnv(
  createStore?: () => PostgresAuthIdentityStore,
): PostgresAuthIdentityStore | null {
  if (!hasPostgresConfig()) {
    return null;
  }

  if (createStore) {
    return createStore();
  }

  return new PostgresAuthIdentityStore({
    queryable: getSharedPostgresPool(),
  });
}
