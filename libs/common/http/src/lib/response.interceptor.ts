import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Option } from '@wish-list/common-result';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import { match } from 'ts-pattern';
import { Envelope } from './envelope.js';
import type { SuccessEnvelope } from './envelope.js';

/**
 * Wraps every successful response in `{ status, data }`. An absent value (a
 * delete) becomes `data: null`, so 204 never appears and the envelope has no hole.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessEnvelope<unknown>> {
    const response = context
      .switchToHttp()
      .getResponse<{ readonly statusCode: number }>();

    return next.handle().pipe(
      map((value: unknown) => {
        const data = Option.from(value).unwrapOr(null);
        return match(response.statusCode)
          .with(HttpStatus.CREATED, () => Envelope.created(data))
          .otherwise(() => Envelope.success(data));
      }),
    );
  }
}
