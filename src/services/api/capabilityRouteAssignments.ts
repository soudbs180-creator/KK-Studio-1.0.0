import type { CapabilityRole, CapabilityRouteAssignment } from '../../types';

const STORAGE_KEY = 'kk_capability_route_assignments_v1';
const CAPABILITY_ROLES: CapabilityRole[] = [
  'image_generation',
  'ppt_generation',
  'ecommerce_generation',
  'assistant',
  'prompt_optimizer',
  'ocr_document',
];

const listeners = new Set<() => void>();

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const buildDefaultAssignments = (): CapabilityRouteAssignment[] => {
  const timestamp = Date.now();
  return CAPABILITY_ROLES.map((role) => ({
    role,
    enabled: role !== 'ocr_document',
    updatedAt: timestamp,
  }));
};

const normalizeAssignment = (
  raw: Partial<CapabilityRouteAssignment> | null | undefined,
): CapabilityRouteAssignment | null => {
  if (!raw || typeof raw !== 'object' || typeof raw.role !== 'string') {
    return null;
  }

  const role = CAPABILITY_ROLES.find((item) => item === raw.role);
  if (!role) {
    return null;
  }

  return {
    role,
    primaryRouteId: typeof raw.primaryRouteId === 'string' ? raw.primaryRouteId.trim() || undefined : undefined,
    primaryModelId: typeof raw.primaryModelId === 'string' ? raw.primaryModelId.trim() || undefined : undefined,
    fallbackRouteId: typeof raw.fallbackRouteId === 'string' ? raw.fallbackRouteId.trim() || undefined : undefined,
    enabled: raw.enabled !== false,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : Date.now(),
  };
};

const readAssignments = (): CapabilityRouteAssignment[] => {
  const defaults = buildDefaultAssignments();
  if (!canUseStorage()) {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return defaults;
    }

    const normalized = parsed
      .map((item) => normalizeAssignment(item))
      .filter((item): item is CapabilityRouteAssignment => Boolean(item));

    const byRole = new Map(normalized.map((item) => [item.role, item] as const));
    return defaults.map((fallback) => byRole.get(fallback.role) || fallback);
  } catch {
    return defaults;
  }
};

const writeAssignments = (assignments: CapabilityRouteAssignment[]) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
};

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

export const getCapabilityRouteAssignments = () => readAssignments();

export const resolveCapabilityRouteAssignment = (role: CapabilityRole) =>
  readAssignments().find((assignment) => assignment.role === role);

export const upsertCapabilityRouteAssignment = (
  role: CapabilityRole,
  patch: Partial<Omit<CapabilityRouteAssignment, 'role' | 'updatedAt'>>,
) => {
  const nextAssignments = readAssignments().map((assignment) => (
    assignment.role === role
      ? {
          ...assignment,
          ...patch,
          updatedAt: Date.now(),
        }
      : assignment
  ));

  writeAssignments(nextAssignments);
  notifyListeners();
  return nextAssignments.find((assignment) => assignment.role === role) || null;
};

export const subscribeCapabilityRouteAssignments = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
