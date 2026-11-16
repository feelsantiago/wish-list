import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Failure } from '@wish-list/common-error';
import { ServiceFailure } from '@wish-list/common-error/service';
import { LoggingModule } from '@wish-list/common-logging';
import { Result } from '@wish-list/common-result';
import { HttpEdgeModule } from './http-edge.module.js';

@Controller()
class BrokenController {
  @Get('broken')
  public broken(): Result<never, ServiceFailure> {
    return Result.err(
      ServiceFailure.unexpected(Failure.create('query', 'SQLITE_BUSY')),
    );
  }
}

/** Own file: nestjs-pino builds its middleware once per process (ADR-0035). */
describe('HttpEdgeModule with exposeFailures', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggingModule.forRootAsync({
          useFactory: () => ({
            level: 'silent',
            pretty: false,
            requestIdHeader: 'x-request-id',
          }),
        }),
        HttpEdgeModule.forRoot({ exposeFailures: true }),
      ],
      controllers: [BrokenController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('adds the cause chain to the error body', async () => {
    const res = await fetch(`${base}/broken`);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      status: 'error',
      error: {
        message: 'Something went wrong',
        failure: { chain: [{ name: 'unexpected' }, { name: 'query' }] },
      },
    });
  });
});
