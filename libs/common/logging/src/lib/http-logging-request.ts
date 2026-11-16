import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import type { Options } from 'pino-http';
import { match, P } from 'ts-pattern';
import { MODULE_OPTIONS_TOKEN } from './logging.options.js';
import type { LoggingModuleOptions } from './logging.options.js';

/**
 * Reads the request id. Reuses a well-formed incoming one so a proxy's or
 * client's trace joins ours, and echoes it on the response either way.
 */
@Injectable()
export class HttpLoggingRequest {
  /** Bounds what a client can inject into the `req.id` log field. */
  private readonly pattern = /^[\w-]{1,64}$/;

  /** Node lowercases incoming header names. */
  private readonly header: string;

  public constructor(
    @Inject(MODULE_OPTIONS_TOKEN) config: LoggingModuleOptions,
  ) {
    this.header = config.requestIdHeader.toLowerCase();
  }

  public options(): Required<Pick<Options, 'genReqId'>> {
    return { genReqId: (req, res) => this.id(req, res) };
  }

  private id(req: IncomingMessage, res: ServerResponse): string {
    const id = match(req.headers[this.header])
      .with(P.string.regex(this.pattern), (incoming) => incoming)
      .otherwise(() => randomUUID());
    res.setHeader(this.header, id);
    return id;
  }
}
