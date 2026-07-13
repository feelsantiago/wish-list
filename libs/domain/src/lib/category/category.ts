import { z, ZodError } from 'zod';
import { createRegExp, charIn, exactly, anyOf, digit } from 'magic-regexp';
import { Result, Option } from '@wish-list/common-result';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

const hexLetter = charIn.from('a', 'f').from('A', 'F');
const hexDigit = anyOf(digit, hexLetter);

const HEX_COLOR_PATTERN = createRegExp(
  exactly('#').at.lineStart().and(hexDigit.times(6)).at.lineEnd(),
);

export interface Category {
  readonly id: Id;
  readonly user: Id;
  readonly name: string;
  readonly color: Option<string>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export namespace Category {
  export const $ = z.object({
    name: z.string().min(1),
    color: z.string().regex(HEX_COLOR_PATTERN).optional(),
  });

  export interface CreateInput {
    readonly user: Id;
    readonly name: string;
    readonly color?: string;
  }

  export function create(
    input: CreateInput,
  ): Result<Category, DomainFailure> {
    return Result.fromThrowable<z.infer<typeof $>, ZodError>(() =>
      $.parse({ name: input.name, color: input.color }),
    )
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating Category'),
      )
      .map((value) => {
        const now = new Date();
        return {
          id: Id.generate(),
          user: input.user,
          name: value.name,
          color: Option.from(value.color),
          createdAt: now,
          updatedAt: now,
        };
      });
  }

  export function from(plain: Plain<Category>): Category {
    return {
      id: plain.id as Id,
      user: plain.user as Id,
      name: plain.name,
      color: Option.from(plain.color),
      createdAt: new Date(plain.createdAt),
      updatedAt: new Date(plain.updatedAt),
    };
  }

  export function plain(category: Category): Plain<Category> {
    return {
      id: category.id,
      user: category.user,
      name: category.name,
      color: category.color.match({ some: (v) => v, none: () => null }),
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }
}
