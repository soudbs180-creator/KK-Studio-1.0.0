export const GenerationTaskStatus = {
  Queued: "queued",
  Running: "running",
  Succeeded: "succeeded",
  Failed: "failed",
  Cancelled: "cancelled",
  Refunded: "refunded",
} as const;

export type GenerationTaskStatus = (typeof GenerationTaskStatus)[keyof typeof GenerationTaskStatus];

export const PaymentOrderStatus = {
  Created: "created",
  Pending: "pending",
  Paid: "paid",
  Failed: "failed",
  Cancelled: "cancelled",
  Refunded: "refunded",
} as const;

export type PaymentOrderStatus = (typeof PaymentOrderStatus)[keyof typeof PaymentOrderStatus];

export const CreditTransactionType = {
  Recharge: "recharge",
  Debit: "debit",
  Refund: "refund",
  Freeze: "freeze",
  Unfreeze: "unfreeze",
} as const;

export type CreditTransactionType = (typeof CreditTransactionType)[keyof typeof CreditTransactionType];

export const WorkflowNodeType = {
  Prompt: "prompt",
  Image: "image",
  VideoInput: "video-input",
  VideoAnalyze: "video-analyze",
  Storyboard: "storyboard",
  Preview: "preview",
  Save: "save",
  Agent: "agent",
} as const;

export type WorkflowNodeType = (typeof WorkflowNodeType)[keyof typeof WorkflowNodeType];

export const ModelAvailability = {
  Public: "public",
  Internal: "internal",
  Disabled: "disabled",
} as const;

export type ModelAvailability = (typeof ModelAvailability)[keyof typeof ModelAvailability];
