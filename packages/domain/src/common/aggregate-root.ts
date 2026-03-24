import { Entity } from "./entity.ts";
import type { DomainEventRecord } from "./domain-event.ts";

export abstract class AggregateRoot<TId extends string = string> extends Entity<TId> {
  private readonly pendingEvents: DomainEventRecord[] = [];

  protected addDomainEvent<TPayload>(event: DomainEventRecord<TPayload>) {
    this.pendingEvents.push(event);
  }

  pullDomainEvents(): DomainEventRecord[] {
    return this.pendingEvents.splice(0, this.pendingEvents.length);
  }
}
