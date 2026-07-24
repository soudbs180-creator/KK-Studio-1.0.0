import { z } from 'zod';

export const ProviderRuntimeHealthSchema = z.object({
  status: z.literal('ok'),
}).strict();

const ProviderRuntimeUpstreamModelSchema = z.object({
  id: z.string().trim().min(1).max(256),
  object: z.literal('model'),
  created: z.number().int().nonnegative().optional(),
  owned_by: z.string().trim().min(1).max(128).optional(),
}).strict();

export const ProviderRuntimeModelsSchema = z.object({
  object: z.literal('list'),
  data: z.array(ProviderRuntimeUpstreamModelSchema).max(1_000),
}).strict();

export interface ProviderRuntimeModel {
  id: string;
  ownedBy?: string;
}

export type ProviderRuntimeHealth = z.infer<typeof ProviderRuntimeHealthSchema>;
