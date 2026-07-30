# database

Drizzle/libSQL persistence layer. NestJS module exposing per-entity repositories, mapped to/from `@wish-list/domain` types via `Result`.

## Contents

- **Schemas** (`drizzle-orm/sqlite-core`): `user`, `wishlist`, `item`, `vendor`, `category`, `coupon`, `coupon-rule`, `reservation`, `tracked-item`, `price-history`
- **Repositories**: one per schema (e.g. `UserRepository`, `WishlistRepository`, ...), each extending `Repository<TEntity, TRow, TTable>` (`find`/`insert`/`update`, all returning `AsyncResult<T, DatabaseFailure>`)
- **Mapper**: `DomainMapper` interface + `DatabaseDomainMapper` base — converts between row and domain shapes, implemented per entity in `*-database-domain-mapper.ts`
- **DatabaseModule**: `ConfigurableModuleBuilder`-based Nest module, register with `{ url }`; provides `DATABASE_CLIENT` and all repositories
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

## Migrations

- `db:generate` — `drizzle-kit generate`
- `db:migrate` — `drizzle-kit migrate`

## Running unit tests

Run `nx test database` to execute the unit tests via [Vitest](https://vitest.dev/).
