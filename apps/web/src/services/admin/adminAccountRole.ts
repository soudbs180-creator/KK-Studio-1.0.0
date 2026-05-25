export type AppAccountRole = 'user' | 'admin' | `member${string}`;

export function normalizeAppAccountRole(rawRole: unknown): AppAccountRole {
  const normalized = String(rawRole || '').trim().toLowerCase();
  if (normalized === 'admin') {
    return 'admin';
  }

  if (normalized.startsWith('member')) {
    return normalized as AppAccountRole;
  }

  return 'user';
}

export function isAdminAccountRole(role: unknown): boolean {
  return normalizeAppAccountRole(role) === 'admin';
}
