import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { FailureFilter } from './failure.filter.js';
import { FailureInterceptor } from './failure.interceptor.js';
import { ConfigurableModuleClass } from './http-edge.options.js';
import { ResponseInterceptor } from './response.interceptor.js';

/**
 * The HTTP edge (ADR-0036): zod request validation, the `{ status, data }`
 * envelope, `Result` unwrapping and the error envelope. Needs `LoggingModule`
 * in the app for `PinoFailureRenderer`.
 *
 * Interceptor order matters: the first registered is outermost, so
 * `FailureInterceptor` unwraps a `Result` before `ResponseInterceptor` wraps it.
 */
@Module({
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: FailureInterceptor },
    { provide: APP_FILTER, useClass: FailureFilter },
  ],
})
export class HttpEdgeModule extends ConfigurableModuleClass {}
