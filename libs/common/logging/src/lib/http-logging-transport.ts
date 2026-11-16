import { Inject, Injectable } from '@nestjs/common';
import type { Options } from 'pino-http';
import { match } from 'ts-pattern';
import { MODULE_OPTIONS_TOKEN } from './logging.options.js';
import type { LoggingModuleOptions } from './logging.options.js';

/** Decides where log lines go and in what shape. */
@Injectable()
export class HttpLoggingTransport {
  public constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly config: LoggingModuleOptions,
  ) {}

  public options(): Pick<Options, 'transport'> {
    return match(this.config.pretty)
      .with(true, () => ({
        transport: { target: 'pino-pretty', options: { singleLine: true } },
      }))
      .with(false, () => ({}))
      .exhaustive();
  }
}
