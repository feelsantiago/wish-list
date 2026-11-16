import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { LoggingModule } from './logging.module.js';

/**
 * Its own file on purpose: nestjs-pino builds its pino-http middleware once per
 * process, so a second app booted in `logging.module.spec.ts` would reuse the
 * first app's request id header. Vitest isolates modules per file.
 */
@Controller()
class PingController {
  @Get('ping')
  public ping(): string {
    return 'pong';
  }
}

describe('LoggingModule.forRootAsync with a custom request id header', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggingModule.forRootAsync({
          useFactory: () => ({
            level: 'silent',
            pretty: false,
            requestIdHeader: 'X-Correlation-Id',
          }),
        }),
      ],
      controllers: [PingController],
    }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reads and echoes the configured header', async () => {
    const res = await fetch(`${await app.getUrl()}/ping`, {
      headers: { 'x-correlation-id': 'trace-42' },
    });
    expect(res.headers.get('x-correlation-id')).toBe('trace-42');
    expect(res.headers.get('x-request-id')).toBeNull();
  });
});
