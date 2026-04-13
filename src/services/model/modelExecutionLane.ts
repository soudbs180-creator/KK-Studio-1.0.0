import { isSystemModelRoute } from './modelRoute.ts';

export type ModelExecutionLane = 'local-user-api' | 'cloud-credit-model';

export function resolveModelExecutionLane(input: {
  modelId: string;
  isCreditModel: boolean;
}): ModelExecutionLane {
  if (input.isCreditModel && isSystemModelRoute(input.modelId)) {
    return 'cloud-credit-model';
  }

  return 'local-user-api';
}
