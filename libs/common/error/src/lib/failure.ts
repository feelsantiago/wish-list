import { match, P } from 'ts-pattern';

export class Failure<T extends string = 'Failure'> extends Error {
  private constructor(
    public override readonly name: T,
    public override readonly message: string,
    public readonly source: Failure | Error | undefined,
    public readonly metadata: Record<string, unknown>,
  ) {
    super(message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, Failure.from);
    }
  }

  public static create<T extends string>(
    name: T,
    message: string,
    metadata: Record<string, unknown> = {},
  ): Failure<T> {
    const f = new Failure<T>(name, message, undefined, metadata);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(f, Failure.create);
    }

    return f;
  }

  public static from(input: string): Failure<'Failure'>;
  public static from(
    input: string,
    metadata: Record<string, unknown>,
  ): Failure<'Failure'>;
  public static from(input: Error): Failure<'Failure'>;
  public static from(
    input: Error,
    metadata: Record<string, unknown>,
  ): Failure<'Failure'>;
  public static from<N extends string>(
    input: Error,
    metadata: Record<string, unknown>,
    name: N,
  ): Failure<N>;
  public static from<F extends Failure<string>>(input: F): F;
  public static from<N extends string>(
    input: Failure<string>,
    metadata?: Record<string, unknown>,
    name?: N,
  ): Failure<N>;
  public static from(
    input: unknown,
    metadata?: Record<string, unknown>,
  ): Failure<'Failure'>;
  public static from<N extends string = 'Failure'>(
    input: unknown,
    metadata: Record<string, unknown> = {},
    name?: N,
  ): Failure<N> | Failure<'Failure'> {
    return match(input)
      .with(
        P.when(
          (v): v is Failure =>
            v instanceof Failure &&
            Object.keys(metadata).length === 0 &&
            name === undefined,
        ),
        (f) => f as Failure<N>,
      )
      .with(
        P.when((v): v is Failure => v instanceof Failure),
        (f) =>
          new Failure<N>(name ?? (f.name as N), f.message, f, {
            ...f.metadata,
            ...metadata,
          }),
      )
      .with(
        P.when((v): v is Error => v instanceof Error),
        (e) => new Failure<N>(name ?? ('Failure' as N), e.message, e, metadata),
      )
      .with(
        P.string,
        (s) => new Failure<'Failure'>('Failure', s, undefined, metadata),
      )
      .otherwise(
        (v) =>
          new Failure<'Failure'>('Failure', String(v), undefined, metadata),
      ) as Failure<N> | Failure<'Failure'>;
  }

  public context<N extends string = T>(
    msg: string,
    metadata: Record<string, unknown> = {},
  ): Failure<N> {
    const f = new Failure<N>(this.name as unknown as N, msg, this, metadata);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(f, this.context);
    }

    return f;
  }

  public withMetadata<N extends string = T>(
    data: Record<string, unknown>,
  ): Failure<N> {
    return new Failure<N>(
      this.name as unknown as N,
      this.message,
      this.source,
      { ...this.metadata, ...data },
    );
  }

  public override toString(): string {
    const lines: string[] = [];
    this._renderText(lines, 0);

    return lines.join('\n');
  }

  private _renderText(lines: string[], depth: number): void {
    const indent = '  '.repeat(depth);
    lines.push(`${indent}[${this.name}] ${this.message}`);

    for (const [k, v] of Object.entries(this.metadata)) {
      lines.push(`${indent}  ${k}: ${String(v)}`);
    }

    match(this.source)
      .with(
        P.when((v): v is Failure => v instanceof Failure),
        (source) => {
          lines.push(`${indent}  caused by:`);
          source._renderText(lines, depth + 1);
        },
      )
      .with(
        P.when((v): v is Error => v instanceof Error),
        (source) => {
          lines.push(
            `${indent}  caused by: [${source.name}] ${source.message}`,
          );
        },
      )
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- no source to render is a valid, terminal case
      .otherwise(() => {});
  }
}
