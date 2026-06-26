import type { RouteMode } from './RouteContext';

export interface RouteDecision {
  mode: RouteMode;
  reason: string;
  fallback?: RouteDecision;
}
