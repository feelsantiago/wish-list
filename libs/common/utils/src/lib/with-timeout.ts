import { AsyncResult, err } from '@wish-list/common-result';
import type { Result } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';

export class WithTimeout {
  public constructor(private readonly ms: number) {}

  public run<T, E>(
    result: AsyncResult<T, E>,
  ): AsyncResult<T, E | Failure<'timeout'>> {
    let timer!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<Result<T, E | Failure<'timeout'>>>(
      (resolve) => {
        timer = setTimeout(
          () =>
            resolve(
              err(Failure.create('timeout', `Timed out after ${this.ms}ms`)),
            ),
          this.ms,
        );
      },
    );

    return new AsyncResult(
      Promise.race([result.toPromise(), timeout]).finally(() =>
        clearTimeout(timer),
      ),
    );
  }
}
