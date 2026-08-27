import { z, ZodError } from 'zod';
import { Result } from '@wish-list/common-result';
import type { Brand } from '../brand/brand.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export type TimeWindow = Brand<number, 'TimeWindow'>;

export namespace TimeWindow {
  export const $ = z.number().positive().finite();

  export function create(input: number): Result<TimeWindow, DomainFailure> {
    return Result.fromThrowable<number, ZodError>(() => $.parse(input))
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating TimeWindow'),
      )
      .map((value) => from(value));
  }

  export function from(value: number): TimeWindow {
    return value as TimeWindow;
  }
}
