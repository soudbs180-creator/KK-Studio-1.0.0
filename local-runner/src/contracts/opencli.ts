import { z } from 'zod';

export const ALLOWED_CDP_ACTIONS = [
  'open',
  'click',
  'type',
  'fill',
  'select',
  'extract',
  'screenshot',
  'network',
  'state',
  'inspect_page',
  'extract_product',
  'generate_external',
] as const;

export const OpencliCommandKindSchema = z.enum(ALLOWED_CDP_ACTIONS);

/** 本地执行命令只接受白名单动作、有限目标和 JSON object payload。 */
export const OpencliCommandSchema = z.object({
  kind: OpencliCommandKindSchema,
  target: z.string().trim().min(1).max(2048),
  payload: z.record(z.unknown()).optional(),
}).strict();

export type OpencliCommand = z.infer<typeof OpencliCommandSchema>;
export type OpencliCommandKind = z.infer<typeof OpencliCommandKindSchema>;
