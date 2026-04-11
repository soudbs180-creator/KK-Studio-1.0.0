import type {
  AdminProfileRecord,
  AdminRole,
} from '../infrastructure/in-memory-admin-console-repository.ts';

export interface PrimaryAdminAccessOptions {
  primaryAdminUserId?: string;
}

export interface ResolvedAdminAccess {
  role: AdminRole;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
}

export function normalizePrimaryAdminUserId(value: string | undefined): string | undefined {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

export function resolveAdminAccess(
  userId: string,
  profile: AdminProfileRecord | undefined,
  options: PrimaryAdminAccessOptions = {},
): ResolvedAdminAccess {
  const primaryAdminUserId = normalizePrimaryAdminUserId(options.primaryAdminUserId);

  if (primaryAdminUserId && userId === primaryAdminUserId) {
    return {
      role: 'admin',
      isAdmin: true,
      isPrimaryAdmin: true,
    };
  }

  const role: AdminRole = profile?.role === 'admin' ? 'admin' : 'user';
  return {
    role,
    isAdmin: role === 'admin',
    isPrimaryAdmin: false,
  };
}
