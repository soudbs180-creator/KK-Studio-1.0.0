import { z } from 'zod';

export const AgentExtensionTypeSchema = z.enum(['skill', 'mcp', 'plugin']);

export const AgentExtensionManifestSchema = z.object({
  schemaVersion: z.literal(1),
  key: z.string().min(1).max(200),
  displayName: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  permissions: z.array(z.string().min(1).max(200)).max(200),
  secretRef: z.string().regex(/^(?:vault|keychain|kms):\/\/[a-zA-Z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/).max(500).optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const AgentExtensionDtoSchema = z.object({
  id: z.string().uuid(),
  type: AgentExtensionTypeSchema,
  manifest: AgentExtensionManifestSchema,
  enabled: z.boolean(),
  importSource: z.enum(['user', 'local-import', 'system']),
  legacyReadonlyUntil: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();

export const AgentExtensionListDtoSchema = z.array(AgentExtensionDtoSchema).max(200);

export const UpsertAgentExtensionRequestSchema = z.object({
  id: z.string().uuid(),
  type: AgentExtensionTypeSchema,
  manifest: AgentExtensionManifestSchema,
  enabled: z.boolean(),
}).strict();

export const DeleteAgentExtensionResponseSchema = z.object({
  id: z.string().uuid(),
  deleted: z.literal(true),
}).strict();

export type AgentExtensionType = z.infer<typeof AgentExtensionTypeSchema>;
export type AgentExtensionManifest = z.infer<typeof AgentExtensionManifestSchema>;
export type AgentExtensionDto = z.infer<typeof AgentExtensionDtoSchema>;
export type AgentExtensionListDto = z.infer<typeof AgentExtensionListDtoSchema>;
export type UpsertAgentExtensionRequest = z.infer<typeof UpsertAgentExtensionRequestSchema>;
export type DeleteAgentExtensionResponse = z.infer<typeof DeleteAgentExtensionResponseSchema>;
