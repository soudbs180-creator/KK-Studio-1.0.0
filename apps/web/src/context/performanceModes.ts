export type WebPerformanceMode = 'auto' | 'smooth' | 'standard' | 'performance' | 'custom';

/** Keeps v1 preferences readable while moving every client to the v4 mode names. */
export function normalizePerformanceMode(value: unknown): WebPerformanceMode {
  if (value === 'fast') return 'smooth';
  if (value === 'balanced') return 'standard';
  if (value === 'visual') return 'performance';
  if (
    value === 'auto'
    || value === 'smooth'
    || value === 'standard'
    || value === 'performance'
    || value === 'custom'
  ) {
    return value;
  }
  return 'auto';
}
