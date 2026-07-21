import { z } from 'zod';

export const ProviderConnectionIdSchema = z.string().uuid();

export const ProviderConnectionStatusSchema = z.enum([
  'unverified',
  'verifying',
  'available',
  'restricted',
  'offline',
  'error',
  'revoked',
]);

/** 公共 Connection DTO 故意不含 secret_ref；strict 模式会阻断意外序列化。 */
export const ProviderConnectionDtoSchema = z.object({
  connectionId: ProviderConnectionIdSchema,
  providerId: z.string().min(1),
  displayName: z.string().min(1).max(120),
  protocolProfile: z.string().min(1).max(100),
  endpoint: z.string().url().max(2048).optional(),
  status: ProviderConnectionStatusSchema,
  hasSecret: z.boolean(),
  verifiedAt: z.string().datetime().optional(),
  verificationErrorCode: z.string().max(100).optional(),
  verificationMessage: z.string().max(500).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export type ProviderConnectionDto = z.infer<typeof ProviderConnectionDtoSchema>;

/** secret 只允许出现在创建请求内，服务端落库前必须转换为加密 secret_ref。 */
export const CreateProviderConnectionRequestSchema = z.object({
  providerId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(120),
  protocolProfile: z.string().min(1).max(100),
  endpoint: z.string().url().max(2048).optional(),
  secret: z.string().min(1).max(65536),
}).strict();

export type CreateProviderConnectionRequest = z.infer<typeof CreateProviderConnectionRequestSchema>;

export const UpdateProviderConnectionRequestSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  endpoint: z.string().url().max(2048).nullable().optional(),
  secret: z.string().min(1).max(65536).optional(),
}).strict().refine(
  (input) => Object.keys(input).length > 0,
  { message: 'At least one provider connection field must be supplied.' },
);

export type UpdateProviderConnectionRequest = z.infer<typeof UpdateProviderConnectionRequestSchema>;

export const ProviderConnectionListDtoSchema = z.object({
  version: z.literal('v1'),
  connections: z.array(ProviderConnectionDtoSchema),
}).strict();

export type ProviderConnectionListDto = z.infer<typeof ProviderConnectionListDtoSchema>;

export const DeleteProviderConnectionResponseDtoSchema = z.object({
  connectionId: ProviderConnectionIdSchema,
  deleted: z.literal(true),
}).strict();

export type DeleteProviderConnectionResponseDto = z.infer<typeof DeleteProviderConnectionResponseDtoSchema>;
