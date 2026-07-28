import { match, P } from 'ts-pattern';
import { DatabaseFailure } from './database-failure.js';

export class DatabaseError {
  private constructor(private readonly source: Error) {}

  public static from(error: unknown): DatabaseError {
    const source = error instanceof Error ? error : new Error(String(error));
    return new DatabaseError(source);
  }

  public failure(): DatabaseFailure {
    const source = this.source as Error & { code?: unknown };
    return match(source)
      .with(
        { code: P.string.startsWith('SQLITE_CONSTRAINT') },
        () => DatabaseFailure.constraint(this.source),
      )
      .otherwise(() => DatabaseFailure.query(this.source));
  }
}
