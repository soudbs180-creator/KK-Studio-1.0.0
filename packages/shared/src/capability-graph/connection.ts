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
export const ProviderConnectionDtoV1Schema = z.object({
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

export const ProviderConnectionDtoV2Schema = ProviderConnectionDtoV1Schema.extend({
  routingPriority: z.number().int().nonnegative(),
}).strict();

/** Both versions remain readable for one release while all new lists emit v2. */
export const ProviderConnectionDtoSchema = z.union([
  ProviderConnectionDtoV2Schema,
  ProviderConnectionDtoV1Schema,
]);

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

export const ProviderConnectionListV1DtoSchema = z.object({
  version: z.literal('v1'),
  connections: z.array(ProviderConnectionDtoV1Schema),
}).strict();

export const ProviderConnectionListV2DtoSchema = z.object({
  version: z.literal('v2'),
  orderRevision: z.number().int().nonnegative(),
  connections: z.array(ProviderConnectionDtoV2Schema),
}).strict();

export const ProviderConnectionListDtoSchema = z.union([
  ProviderConnectionListV2DtoSchema,
  ProviderConnectionListV1DtoSchema,
]);

export type ProviderConnectionListDto = z.infer<typeof ProviderConnectionListDtoSchema>;

export const ReorderProviderConnectionsRequestSchema = z.object({
  connectionIds: z.array(ProviderConnectionIdSchema).min(1).max(500),
  expectedOrderRevision: z.number().int().nonnegative(),
}).strict().superRefine((input, context) => {
  if (new Set(input.connectionIds).size !== input.connectionIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['connectionIds'],
      message: 'Provider Connection order cannot contain duplicate IDs.',
    });
  }
});

export type ReorderProviderConnectionsRequest = z.infer<typeof ReorderProviderConnectionsRequestSchema>;

export const DeleteProviderConnectionResponseDtoSchema = z.object({
  connectionId: ProviderConnectionIdSchema,
  deleted: z.literal(true),
}).strict();

export type DeleteProviderConnectionResponseDto = z.infer<typeof DeleteProviderConnectionResponseDtoSchema>;
