export class InFlightCache<K, V> {
  private readonly jobs = new Map<K, Promise<V>>();

  public execute({ key, job }: { key: K; job: () => Promise<V> }): Promise<V> {
    const pending = this.jobs.get(key) ?? this.dispatch(key, job);
    this.jobs.set(key, pending);

    return pending;
  }

  private dispatch(key: K, job: () => Promise<V>): Promise<V> {
    return job().finally(() => this.jobs.delete(key));
  }
}
