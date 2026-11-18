import { Catch, HttpException, HttpStatus, Inject } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Failure } from '@wish-list/common-error';
import { PinoFailureRenderer } from '@wish-list/common-logging';
import type { RenderedFailure } from '@wish-list/common-logging';
import { ZodValidationException } from 'nestjs-zod';
import { match, P } from 'ts-pattern';
import { z } from 'zod';
import { Envelope } from './envelope.js';
import type { ErrorBody, ValidationIssue } from './envelope.js';
import { FailureHttpException } from './failure-http-exception.js';
import { FailureStatus } from './failure-status.js';
import { MODULE_OPTIONS_TOKEN } from './http-edge.options.js';
import type { HttpEdgeModuleOptions } from './http-edge.options.js';

type Resolved = {
  readonly status: number;
  readonly body: ErrorBody;
  readonly failure: Failure<string>;
  readonly headers: Readonly<Record<string, string>>;
};

type JsonResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
};

/**
 * Catches everything and writes `{ status: 'error', error }`. Server errors are
 * logged through `PinoFailureRenderer`; client errors are left to pino-http's
 * request line.
 */
@Catch()
export class FailureFilter implements ExceptionFilter {
  /** Read structurally: nestjs-zod hands back the zod error as `unknown`. */
  private static readonly ZodIssues = z.object({
    issues: z.array(
      z.object({ path: z.array(z.unknown()), message: z.string() }),
    ),
  });

  public constructor(
    @Inject(PinoFailureRenderer)
    private readonly renderer: PinoFailureRenderer,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: HttpEdgeModuleOptions,
  ) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body, failure, headers } = this.resolve(exception);

    match(status >= HttpStatus.INTERNAL_SERVER_ERROR)
      .with(true, () => this.renderer.print(failure))
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- client errors are not logged here
      .with(false, () => {})
      .exhaustive();

    const response = host.switchToHttp().getResponse<JsonResponse>();
    Object.entries(headers).forEach(([name, value]) =>
      response.setHeader(name, value),
    );
    response
      .status(status)
      .json(Envelope.error({ ...body, ...this.expose(failure) }));
  }

  private resolve(exception: unknown): Resolved {
    return match(exception)
      .with(P.instanceOf(FailureHttpException), (e) => ({
        status: e.getStatus(),
        body: { message: e.message },
        failure: e.failure,
        headers: e.headers,
      }))
      .with(P.instanceOf(ZodValidationException), (e) => ({
        status: e.getStatus(),
        body: {
          message: FailureStatus.message('invalid'),
          issues: this.issues(e.getZodError()),
        },
        failure: Failure.from(e),
        headers: {},
      }))
      .with(P.instanceOf(HttpException), (e) => ({
        status: e.getStatus(),
        body: { message: e.message },
        failure: Failure.from(e),
        headers: {},
      }))
      .otherwise((e) => ({
        status: FailureStatus.of('unexpected'),
        body: { message: FailureStatus.message('unexpected') },
        failure: Failure.from(e),
        headers: {},
      }));
  }

  private issues(error: unknown): ValidationIssue[] {
    return match(FailureFilter.ZodIssues.safeParse(error))
      .with({ success: true }, ({ data }) =>
        data.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      )
      .otherwise(() => []);
  }

  private expose(failure: Failure<string>): Pick<ErrorBody, 'failure'> {
    return match(this.options.exposeFailures)
      .with(true, () => ({
        failure: (JSON.parse(this.renderer.render(failure)) as RenderedFailure)
          .failure,
      }))
      .with(false, () => ({}))
      .exhaustive();
  }
}
