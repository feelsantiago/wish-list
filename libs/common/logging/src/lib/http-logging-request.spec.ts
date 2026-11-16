import { describe, it, expect, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpLoggingRequest } from './http-logging-request.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function identify(
  requestIdHeader: string,
  headers: Record<string, string>,
): { id: unknown; setHeader: ReturnType<typeof vi.fn> } {
  const setHeader = vi.fn();
  const req = { headers } as unknown as IncomingMessage;
  const res = { setHeader } as unknown as ServerResponse;
  const request = new HttpLoggingRequest({
    level: 'info',
    pretty: false,
    requestIdHeader,
  });
  return { id: request.options().genReqId(req, res), setHeader };
}

describe('HttpLoggingRequest', () => {
  it('reuses and echoes a well-formed incoming id', () => {
    const { id, setHeader } = identify('x-request-id', {
      'x-request-id': 'edge-abc_123',
    });
    expect(id).toBe('edge-abc_123');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'edge-abc_123');
  });

  it('replaces a malformed incoming id with a uuid', () => {
    const { id, setHeader } = identify('x-request-id', {
      'x-request-id': 'has spaces; and=junk',
    });
    expect(id).toMatch(UUID);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', id);
  });

  it('generates an id when the header is absent', () => {
    const { id } = identify('x-request-id', {});
    expect(id).toMatch(UUID);
  });

  it('reads a custom header, matching its name case-insensitively', () => {
    const { id, setHeader } = identify('X-Correlation-Id', {
      'x-correlation-id': 'trace-42',
    });
    expect(id).toBe('trace-42');
    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'trace-42');
  });
});
