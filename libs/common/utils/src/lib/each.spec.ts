import { describe, expect, it, vi } from 'vitest';
import { Each } from './each.js';

describe('Each.map', () => {
  it('applies the function to every item, in order', () => {
    expect(Each.map((n: number) => n * 2)([1, 2, 3])).toEqual([2, 4, 6]);
  });

  it('returns an empty array for an empty input', () => {
    expect(Each.map((n: number) => n * 2)([])).toEqual([]);
  });

  it('passes only the item, never the index or array', () => {
    const fn = vi.fn((item: string) => item);

    Each.map(fn)(['a', 'b']);

    expect(fn.mock.calls).toEqual([['a'], ['b']]);
  });
});
