import { Injectable } from '@nestjs/common';
import type { Options } from 'pino-http';

/**
 * Censors credentials and emails. Paths are explicit: an `email` nested deeper
 * than listed is not caught, so new metadata shapes must add a path.
 */
@Injectable()
export class HttpLoggingRedact {
  private readonly paths = [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
    'email',
    '*.email',
    'failure.chain[*].metadata.email',
    'failure.chain[*].metadata.*.email',
  ];

  private readonly censor = '[redacted]';

  public options(): Required<Pick<Options, 'redact'>> {
    return { redact: { paths: this.paths, censor: this.censor } };
  }
}
