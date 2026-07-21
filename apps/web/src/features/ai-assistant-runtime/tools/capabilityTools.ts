import {
  CapabilityGraphSnapshotDtoSchema,
  type CapabilityGraphSnapshotDto,
} from '@kk/shared';
import { kkWebApiClient } from '../../../services/api/kkApiClient.ts';
import type { AgentToolDefinition } from './ToolRegistry.ts';

function createCapabilityUnavailableError(): Error & { code: string } {
  const error = new Error('Capability snapshot is unavailable. Check Connections and retry.') as Error & { code: string };
  error.code = 'CAPABILITY_UNAVAILABLE';
  return error;
}

/**
 * Agent capability discovery must use the authenticated server projection, never local Provider guesses.
 */
export const capabilityTools: AgentToolDefinition[] = [
  {
    name: 'capabilities.listAvailable',
    description: 'Read the authenticated capability graph without exposing Provider credentials.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', required: ['version', 'generatedAt', 'nodes', 'edges'] },
    control: {
      effect: 'read',
      impact: { scope: 'account', summary: 'Reads Provider, Connection, Model and Capability availability.', cardinality: 'multiple' },
      cost: { kind: 'none', summary: 'No credits or Provider quota are consumed.' },
      recovery: { cancellable: true, reversible: false, retryable: true },
      idempotency: { required: false, keyField: 'idempotencyKey' },
      failure: { categories: ['setup', 'network', 'validation'], defaultRetryable: true },
    },
    handler: async (_input, context): Promise<CapabilityGraphSnapshotDto> => {
      const response = await kkWebApiClient.getCapabilityGraphSnapshot({ signal: context.signal });
      if (!response.success) throw createCapabilityUnavailableError();
      return CapabilityGraphSnapshotDtoSchema.parse(response.data);
    },
  },
];
