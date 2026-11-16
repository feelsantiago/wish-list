import { Inject, Injectable } from '@nestjs/common';
import type { Params } from 'nestjs-pino';
import { HttpLoggingRedact } from './http-logging-redact.js';
import { HttpLoggingRequest } from './http-logging-request.js';
import { HttpLoggingTransport } from './http-logging-transport.js';
import { MODULE_OPTIONS_TOKEN } from './logging.options.js';
import type { LoggingModuleOptions } from './logging.options.js';

/** Composes each concern's slice of pino-http options into `nestjs-pino` params. */
@Injectable()
export class HttpLoggingParams {
  public constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly config: LoggingModuleOptions,
    @Inject(HttpLoggingTransport)
    private readonly transport: HttpLoggingTransport,
    @Inject(HttpLoggingRequest)
    private readonly request: HttpLoggingRequest,
    @Inject(HttpLoggingRedact)
    private readonly redact: HttpLoggingRedact,
  ) {}

  public build(): Params {
    return {
      pinoHttp: {
        level: this.config.level,
        ...this.transport.options(),
        ...this.request.options(),
        ...this.redact.options(),
      },
    };
  }
}
