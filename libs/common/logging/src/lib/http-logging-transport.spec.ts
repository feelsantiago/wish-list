import { describe, it, expect } from 'vitest';
import { HttpLoggingTransport } from './http-logging-transport.js';

const config = { level: 'info', requestIdHeader: 'x-request-id' } as const;

describe('HttpLoggingTransport', () => {
  it('routes through pino-pretty when pretty', () => {
    const transport = new HttpLoggingTransport({ ...config, pretty: true });
    expect(transport.options()).toEqual({
      transport: { target: 'pino-pretty', options: { singleLine: true } },
    });
  });

  it('adds no transport when not pretty, leaving JSON on stdout', () => {
    const transport = new HttpLoggingTransport({ ...config, pretty: false });
    expect(transport.options()).toEqual({});
  });
});
