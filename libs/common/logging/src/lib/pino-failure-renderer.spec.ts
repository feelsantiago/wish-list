import { describe, it, expect, vi } from 'vitest';
import { Failure } from '@wish-list/common-error';
import type { PinoLogger } from 'nestjs-pino';
import { PinoFailureRenderer } from './pino-failure-renderer.js';

function setup(): {
  renderer: PinoFailureRenderer;
  error: ReturnType<typeof vi.fn>;
} {
  const error = vi.fn();
  const logger = { setContext: vi.fn(), error } as unknown as PinoLogger;
  return { renderer: new PinoFailureRenderer(logger), error };
}

const chained = Failure.from(
  Failure.from(
    new TypeError('socket hang up'),
    { url: 'https://shop.test' },
    'fetch-failed',
  ),
  { email: 'a@b.test' },
  'extraction-failed',
);

describe('PinoFailureRenderer', () => {
  it('flattens the cause chain, top failure first, ending at the plain Error', () => {
    const { renderer } = setup();
    const { failure } = JSON.parse(renderer.render(chained, { stacks: false }));
    expect(failure.chain).toEqual([
      {
        name: 'extraction-failed',
        message: 'socket hang up',
        metadata: { url: 'https://shop.test', email: 'a@b.test' },
      },
      {
        name: 'fetch-failed',
        message: 'socket hang up',
        metadata: { url: 'https://shop.test' },
      },
      { name: 'TypeError', message: 'socket hang up', metadata: {} },
    ]);
  });

  it('includes stacks by default', () => {
    const { renderer } = setup();
    const { failure } = JSON.parse(
      renderer.render(Failure.create('boom', 'it broke')),
    );
    expect(failure.chain[0].stack).toContain('it broke');
  });

  it('prints the chain at error level with the top message', () => {
    const { renderer, error } = setup();
    renderer.print(Failure.create('boom', 'it broke'), { stacks: false });
    expect(error).toHaveBeenCalledWith(
      {
        failure: {
          chain: [{ name: 'boom', message: 'it broke', metadata: {} }],
        },
      },
      'it broke',
    );
  });
});
