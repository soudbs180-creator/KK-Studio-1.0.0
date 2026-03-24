export interface DomainEventRecord<TPayload = unknown> {
  name: string;
  aggregateId: string;
  occurredAt: string;
  payload: TPayload;
}
