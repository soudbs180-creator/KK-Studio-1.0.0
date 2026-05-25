export interface Repository<TEntity, TId extends string = string> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<void>;
}
