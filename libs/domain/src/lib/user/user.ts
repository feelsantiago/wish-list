import { z, ZodError } from 'zod';
import { Result, Option } from '@wish-list/common-result';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import { Email } from '../email/email.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export type Plan = 'free' | 'pro';
export type Status = 'active' | 'deactivated';

export interface User {
  readonly id: Id;
  readonly email: Email;
  readonly name: string;
  readonly provider: string;
  readonly providerId: string;
  readonly plan: Plan;
  readonly status: Status;
  readonly deactivatedAt: Option<Date>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type FreeUser = User & { readonly plan: 'free' };
export type ProUser = User & { readonly plan: 'pro' };

export type ActiveUser = User & { readonly status: 'active' };
export type DeactivatedUser = User & { readonly status: 'deactivated' };

export namespace User {
  export const $ = z.object({
    email: Email.$,
    name: z.string().min(1),
    provider: z.string().min(1),
    providerId: z.string().min(1),
  });

  export interface CreateInput {
    readonly email: string;
    readonly name: string;
    readonly provider: string;
    readonly providerId: string;
  }

  export function create(
    input: CreateInput,
  ): Result<FreeUser, DomainFailure> {
    return Result.fromThrowable<z.infer<typeof $>, ZodError>(() =>
      $.parse(input),
    )
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating User'),
      )
      .map((value) => {
        const now = new Date();
        return {
          id: Id.generate(),
          email: Email.from(value.email),
          name: value.name,
          provider: value.provider,
          providerId: value.providerId,
          plan: 'free',
          status: 'active',
          deactivatedAt: Option.none(),
          createdAt: now,
          updatedAt: now,
        };
      });
  }

  export function deactivate(user: ActiveUser): DeactivatedUser {
    return {
      ...user,
      status: 'deactivated',
      deactivatedAt: Option.some(new Date()),
      updatedAt: new Date(),
    };
  }

  export function reactivate(user: DeactivatedUser): ActiveUser {
    return {
      ...user,
      status: 'active',
      deactivatedAt: Option.none(),
      updatedAt: new Date(),
    };
  }

  export function from(plain: Plain<User>): User {
    return {
      id: plain.id as Id,
      email: plain.email as Email,
      name: plain.name,
      provider: plain.provider,
      providerId: plain.providerId,
      plan: plain.plan,
      status: plain.status,
      deactivatedAt: Option.from(plain.deactivatedAt).map(
        (value) => new Date(value),
      ),
      createdAt: new Date(plain.createdAt),
      updatedAt: new Date(plain.updatedAt),
    };
  }

  export function plain(user: User): Plain<User> {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      providerId: user.providerId,
      plan: user.plan,
      status: user.status,
      deactivatedAt: user.deactivatedAt.match({
        some: (value) => value.toISOString(),
        none: () => null,
      }),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
