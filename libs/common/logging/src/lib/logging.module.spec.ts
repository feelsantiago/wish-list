import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { LoggingModule } from './logging.module.js';
import { PinoFailureRenderer } from './pino-failure-renderer.js';

@Controller()
class PingController {
  @Get('ping')
  public ping(): string {
    return 'pong';
  }
}

async function boot(requestIdHeader: string): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      LoggingModule.forRootAsync({
        useFactory: () => ({ level: 'silent', pretty: false, requestIdHeader }),
      }),
    ],
    controllers: [PingController],
  }).compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(0);
  return app;
}

describe('LoggingModule.forRootAsync', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await boot('x-request-id');
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  function ping(headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${base}/ping`, { headers });
  }

  it('echoes a well-formed incoming x-request-id', async () => {
    const res = await ping({ 'x-request-id': 'edge-abc_123' });
    expect(res.headers.get('x-request-id')).toBe('edge-abc_123');
  });

  it('replaces a malformed x-request-id with a generated uuid', async () => {
    const res = await ping({ 'x-request-id': 'has spaces; and=junk' });
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('generates an id when none is sent', async () => {
    const res = await ping();
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('provides PinoFailureRenderer globally', () => {
    expect(app.get(PinoFailureRenderer)).toBeInstanceOf(PinoFailureRenderer);
  });
});
