import { AsyncResult, ok } from '@wish-list/common-result';
import { WithTimeout } from './with-timeout.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('WithTimeout.run', () => {
  it('resolves with the inner result when it settles before the budget', async () => {
    const result = await new WithTimeout(50)
      .run(AsyncResult.fromResult(ok('done')))
      .toPromise();

    expect(result.unwrapOr('timed-out')).toBe('done');
  });

  it('resolves err(Failure("timeout")) when the clock wins', async () => {
    vi.useFakeTimers();

    const never = new AsyncResult<string, never>(new Promise(() => undefined));
    const pending = new WithTimeout(50).run(never).toPromise();

    await vi.advanceTimersByTimeAsync(50);
    const result = await pending;

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.name).toBe('timeout');
    }
  });

  it('clears the timer once the inner result wins the race', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(global, 'clearTimeout');

    await new WithTimeout(50).run(AsyncResult.fromResult(ok('done'))).toPromise();

    expect(clearSpy).toHaveBeenCalled();
  });
});
