import { InFlightCache } from './in-flight-cache.js';

describe('InFlightCache.execute', () => {
  it('shares one promise across concurrent calls for the same key', async () => {
    const cache = new InFlightCache<string, string>();
    let calls = 0;
    const job = () =>
      new Promise<string>((resolve) => {
        calls += 1;
        setTimeout(() => resolve('done'), 0);
      });

    const [first, second] = await Promise.all([
      cache.execute({ key: 'a', job }),
      cache.execute({ key: 'a', job }),
    ]);

    expect(calls).toBe(1);
    expect(first).toBe('done');
    expect(second).toBe('done');
  });

  it('never shares a promise between different keys', async () => {
    const cache = new InFlightCache<string, string>();
    let calls = 0;
    const job = () =>
      new Promise<string>((resolve) => {
        calls += 1;
        setTimeout(() => resolve('done'), 0);
      });

    await Promise.all([
      cache.execute({ key: 'a', job }),
      cache.execute({ key: 'b', job }),
    ]);

    expect(calls).toBe(2);
  });

  it('runs the job again once the prior job has settled', async () => {
    const cache = new InFlightCache<string, string>();
    let calls = 0;
    const job = () => {
      calls += 1;
      return Promise.resolve('done');
    };

    await cache.execute({ key: 'a', job });
    await cache.execute({ key: 'a', job });

    expect(calls).toBe(2);
  });
});
