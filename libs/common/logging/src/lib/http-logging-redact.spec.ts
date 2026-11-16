import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import { pino } from 'pino';
import { HttpLoggingRedact } from './http-logging-redact.js';

function logged(entry: object): Record<string, unknown> {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done): void {
      lines.push(String(chunk));
      done();
    },
  });
  pino({ ...new HttpLoggingRedact().options() }, stream).info(entry);
  return JSON.parse(lines[0] ?? '{}');
}

describe('HttpLoggingRedact', () => {
  it('censors credential headers', () => {
    const line = logged({
      req: {
        headers: {
          authorization: 'Bearer secret',
          cookie: 'sid=abc',
          host: 'x',
        },
      },
      res: { headers: { 'set-cookie': 'sid=abc' } },
    });
    expect(line['req']).toEqual({
      headers: { authorization: '[redacted]', cookie: '[redacted]', host: 'x' },
    });
    expect(line['res']).toEqual({ headers: { 'set-cookie': '[redacted]' } });
  });

  it('censors emails at the top level and one level down', () => {
    const line = logged({ email: 'a@b.test', user: { email: 'a@b.test' } });
    expect(line['email']).toBe('[redacted]');
    expect(line['user']).toEqual({ email: '[redacted]' });
  });

  it('censors emails in every failure chain link, including rejected input', () => {
    const line = logged({
      failure: {
        chain: [
          { metadata: { email: 'a@b.test' } },
          { metadata: { input: { email: 'a@b.test' }, field: 'email' } },
        ],
      },
    });
    expect(line['failure']).toEqual({
      chain: [
        { metadata: { email: '[redacted]' } },
        { metadata: { input: { email: '[redacted]' }, field: 'email' } },
      ],
    });
  });
});
