export const domainEventNames = {
  generationTaskCreated: "generation.task.created",
  generationTaskCompleted: "generation.task.completed",
  billingCreditDebited: "billing.credit.debited",
  billingCreditRefunded: "billing.credit.refunded",
  paymentOrderPaid: "payment.order.paid",
} as const;

export type DomainEventName = (typeof domainEventNames)[keyof typeof domainEventNames];

export interface DomainEvent<TPayload = unknown> {
  id: string;
  name: DomainEventName;
  aggregateId: string;
  occurredAt: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
}
