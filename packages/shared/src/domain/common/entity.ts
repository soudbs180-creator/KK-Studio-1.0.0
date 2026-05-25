export abstract class Entity<TId extends string = string> {
  readonly id: TId;

  protected constructor(id: TId) {
    this.id = id;
  }

  equals(other?: Entity<TId>): boolean {
    if (!other) return false;
    return this.id === other.id;
  }
}
