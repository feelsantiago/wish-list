import { z, ZodError } from 'zod';
import { match } from 'ts-pattern';
import { Result, Option } from '@wish-list/common-result';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import { Email } from '../email/email.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';
import type { Identity } from '../identity/identity.js';

export type Plan = 'free' | 'pro';
export type Status = 'active' | 'deactivated';
/** Who wrote `name` last: the identity broker or the user (ADR-0040). */
export type NameSource = 'broker' | 'user';

export interface User {
  readonly id: Id;
  readonly email: Email;
  readonly name: string;
  readonly nameSource: NameSource;
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

  export function create(input: CreateInput): Result<FreeUser, DomainFailure> {
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
          nameSource: 'broker',
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

  /**
   * First sign-in (ADR-0040): the broker's name, or the email's local part
   * when it reported none. Either way the name counts as `'broker'`.
   */
  export function fromIdentity(
    identity: Identity,
  ): Result<FreeUser, DomainFailure> {
    return create({
      email: identity.email,
      name: identity.name.unwrapOrElse(() => Email.localPart(identity.email)),
      provider: identity.provider,
      providerId: identity.providerId,
    });
  }

  /**
   * Returning sign-in (ADR-0032, ADR-0040): `email` and `provider` always
   * follow the broker; `name` follows it only while `nameSource` is
   * `'broker'` and the broker reported one. `Some` only when a field changed.
   */
  export function sync<T extends User>(user: T, identity: Identity): Option<T> {
    const name = match(user.nameSource)
      .with('user', () => user.name)
      .with('broker', () => identity.name.unwrapOr(user.name))
      .exhaustive();

    const changed =
      name !== user.name ||
      identity.email !== user.email ||
      identity.provider !== user.provider;

    return match(changed)
      .with(true, () =>
        Option.some<T>({
          ...user,
          name,
          email: identity.email,
          provider: identity.provider,
          updatedAt: new Date(),
        }),
      )
      .with(false, () => Option.none<T>())
      .exhaustive();
  }

  /** In-app rename (ADR-0040): from now on the broker never touches the name. */
  export function rename<T extends User>(
    user: T,
    name: string,
  ): Result<T, DomainFailure> {
    return Result.fromThrowable<string, ZodError>(() =>
      $.shape.name.parse(name),
    )
      .mapErr((error) =>
        DomainFailure.validation({ name }, error).context('Renaming User'),
      )
      .map((value) => ({
        ...user,
        name: value,
        nameSource: 'user' as const,
        updatedAt: new Date(),
      }));
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
      nameSource: plain.nameSource,
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
      nameSource: user.nameSource,
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
