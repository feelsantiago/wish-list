import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { Body, Controller, Get, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Failure } from '@wish-list/common-error';
import { ServiceFailure } from '@wish-list/common-error/service';
import { LoggingModule, PinoFailureRenderer } from '@wish-list/common-logging';
import { AsyncResult, Result } from '@wish-list/common-result';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { FailureMessages } from './failure-messages.decorator.js';
import { HttpEdgeModule } from './http-edge.module.js';

class CreateThingDto extends createZodDto(
  z.object({ name: z.string().min(1), size: z.number().int() }),
) {}

@Controller('things')
@FailureMessages({ 'not-found': 'Thing not found', conflict: 'Thing clash' })
class ThingController {
  @Get('plain')
  public plain(): { ok: true } {
    return { ok: true };
  }

  @Get('ok')
  public ok(): Result<{ id: string }, never> {
    return Result.ok({ id: 't1' });
  }

  @Get('async')
  public async(): AsyncResult<number, never> {
    return AsyncResult.fromResult(Result.ok(42));
  }

  @Get('promise')
  public promise(): Promise<Result<string, never>> {
    return Promise.resolve(Result.ok('later'));
  }

  @Get('void')
  public void(): Result<void, never> {
    return Result.ok(undefined);
  }

  @Post()
  public create(@Body() body: CreateThingDto): Result<CreateThingDto, never> {
    return Result.ok(body);
  }

  @Get('missing')
  public missing(): Result<never, ServiceFailure> {
    return Result.err(ServiceFailure.notFound('t9'));
  }

  @Get('clash')
  @FailureMessages({ conflict: 'Name already taken' })
  public clash(): Result<never, ServiceFailure> {
    return Result.err(ServiceFailure.conflict('unique name'));
  }

  @Get('forbidden')
  public forbidden(): Result<never, ServiceFailure> {
    return Result.err(ServiceFailure.forbidden('user:u1', 'wishlist:w1'));
  }

  @Get('broken')
  public broken(): Result<never, ServiceFailure> {
    return Result.err(
      ServiceFailure.unexpected(
        Failure.create('query', 'SQLITE_BUSY', { email: 'a@b.test' }),
      ),
    );
  }

  @Get('throws')
  public throws(): never {
    throw new TypeError('boom');
  }
}

/** Separate controller: no class-level overrides. */
@Controller('others')
class OtherController {
  @Get('missing')
  public missing(): Result<never, ServiceFailure> {
    return Result.err(ServiceFailure.notFound('o1'));
  }
}

describe('HttpEdgeModule', () => {
  let app: INestApplication;
  let base: string;
  let print: ReturnType<typeof vi.spyOn>;

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
        HttpEdgeModule.forRoot({ exposeFailures: false }),
      ],
      controllers: [ThingController, OtherController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    print = vi.spyOn(app.get(PinoFailureRenderer), 'print');
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  async function call(
    path: string,
    init: RequestInit = {},
  ): Promise<{ status: number; body: unknown }> {
    const res = await fetch(`${base}${path}`, init);
    return { status: res.status, body: await res.json() };
  }

  describe('success envelope', () => {
    it('wraps a plain value', async () => {
      expect(await call('/things/plain')).toEqual({
        status: 200,
        body: { status: 'success', data: { ok: true } },
      });
    });

    it('unwraps Ok', async () => {
      expect(await call('/things/ok')).toEqual({
        status: 200,
        body: { status: 'success', data: { id: 't1' } },
      });
    });

    it('unwraps an AsyncResult', async () => {
      expect((await call('/things/async')).body).toEqual({
        status: 'success',
        data: 42,
      });
    });

    it('unwraps a Promise of Result', async () => {
      expect((await call('/things/promise')).body).toEqual({
        status: 'success',
        data: 'later',
      });
    });

    it('turns an absent value into data: null', async () => {
      expect(await call('/things/void')).toEqual({
        status: 200,
        body: { status: 'success', data: null },
      });
    });

    it('marks a 201 as created', async () => {
      const result = await call('/things', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'lamp', size: 2 }),
      });
      expect(result).toEqual({
        status: 201,
        body: { status: 'created', data: { name: 'lamp', size: 2 } },
      });
    });
  });

  describe('error envelope', () => {
    it('uses the class-level message override', async () => {
      expect(await call('/things/missing')).toEqual({
        status: 404,
        body: { status: 'error', error: { message: 'Thing not found' } },
      });
    });

    it('prefers the handler-level override over the class-level one', async () => {
      expect(await call('/things/clash')).toEqual({
        status: 409,
        body: { status: 'error', error: { message: 'Name already taken' } },
      });
    });

    it('falls back to the default message', async () => {
      expect(await call('/things/forbidden')).toEqual({
        status: 403,
        body: { status: 'error', error: { message: 'Forbidden' } },
      });
      expect(await call('/others/missing')).toEqual({
        status: 404,
        body: { status: 'error', error: { message: 'Not found' } },
      });
    });

    it('reports validation issues with a 400', async () => {
      const result = await call('/things', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '', size: 1.5 }),
      });
      expect(result.status).toBe(400);
      expect(result.body).toEqual({
        status: 'error',
        error: {
          message: 'Invalid request',
          issues: [
            { path: 'name', message: expect.any(String) },
            { path: 'size', message: expect.any(String) },
          ],
        },
      });
    });

    it('envelopes an unknown route', async () => {
      const result = await call('/nope');
      expect(result.status).toBe(404);
      expect(result.body).toEqual({
        status: 'error',
        error: { message: expect.any(String) },
      });
    });

    it('does not log client errors', async () => {
      print.mockClear();
      await call('/things/missing');
      expect(print).not.toHaveBeenCalled();
    });

    it('hides an unexpected failure and logs its chain', async () => {
      print.mockClear();
      const result = await call('/things/broken');
      expect(result).toEqual({
        status: 500,
        body: { status: 'error', error: { message: 'Something went wrong' } },
      });
      expect(print).toHaveBeenCalledOnce();
      const [logged] = print.mock.calls[0] as [Failure<string>];
      expect(logged.name).toBe('unexpected');
      expect(logged.source).toBeInstanceOf(Failure);
    });

    it('hides a thrown error and logs it', async () => {
      print.mockClear();
      expect(await call('/things/throws')).toEqual({
        status: 500,
        body: { status: 'error', error: { message: 'Something went wrong' } },
      });
      expect(print).toHaveBeenCalledOnce();
    });
  });
});
