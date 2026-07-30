# database

Drizzle/libSQL persistence layer. NestJS module exposing per-entity repositories, mapped to/from `@wish-list/domain` types via `Result`.

## Contents

- **Schemas** (`drizzle-orm/sqlite-core`): `user`, `wishlist`, `item`, `vendor`, `category`, `coupon`, `coupon-rule`, `reservation`, `tracked-item`, `price-history`
- **Repositories**: one per schema (e.g. `UserRepository`, `WishlistRepository`, ...), each extending `Repository<TEntity, TRow, TTable>` (`find`/`insert`/`update`, all returning `AsyncResult<T, DatabaseFailure>`)
- **Mapper**: `DomainMapper` interface + `DatabaseDomainMapper` base — converts between row and domain shapes, implemented per entity in `*.mapper.ts`. Simple entities (user, wishlist, category, vendor, reservation, tracked-item) use a factory + DI provider (`create*Mapper` / `*MapperProvider`); entities with variant shapes (coupon, coupon-rule, item, price-history) use an `@Injectable` mapper class that pattern-matches on the discriminated union via `ts-pattern`
- **Repositories**: aggregator class (`Repositories`) that injects every repository onto a single object (`repositories.users`, `repositories.wishlists`, ...) for call sites that need more than one
- **DatabaseModule**: `ConfigurableModuleBuilder`-based Nest module, register with `{ url }`; provides `DATABASE_CLIENT` (token defined in `database-client.token.ts`), every repository, and `Repositories`
- **Database.transaction**: wraps `db.transaction` in `AsyncResult`
- **DatabaseFailure** / **DatabaseError**: typed failures for repository/transaction errors

## Usage

```ts
import { DatabaseModule, UserRepository } from '@wish-list/database';

@Module({
  imports: [DatabaseModule.register({ url: process.env.DATABASE_URL })],
})
export class AppModule {}
```

Or inject `Repositories` to grab several repos through one dependency:

```ts
import { Repositories } from '@wish-list/database';

@Injectable()
export class SomeService {
  public constructor(private readonly repositories: Repositories) {}
}
```

## Migrations

- `db:generate` — `drizzle-kit generate`
- `db:migrate` — `drizzle-kit migrate`

## Testing

- `testing/testing-module.ts` — `createTestingModule(db)` builds a Nest `TestingModule` wired with all mapper providers and repositories against a given `LibSQLDatabase`, for repository-level integration tests
- `testing/fixtures.ts` — `make*` builders (`makeUser`, `makeVendor`, `makeCategory`, `makeWishlist`, `makeFixedCoupon`, `makePercentageCoupon`, `makeCouponRule`, `makeReservation`, `makeTrackedItem`, `makePriceHistory`) for constructing domain entities in tests with sensible defaults

Run `nx test database` to execute the unit tests via [Vitest](https://vitest.dev/).
