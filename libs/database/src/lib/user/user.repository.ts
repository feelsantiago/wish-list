import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { User } from '@wish-list/domain';
import type { Plain } from '@wish-list/domain';
import { Repository, wrap } from '../repository/repository.js';
import { users } from './user.schema.js';

export class UserRepository extends Repository<User, Plain<User>, typeof users> {
  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: users,
      toRow: User.plain,
      fromRow: wrap(User.from),
    });
  }
}
