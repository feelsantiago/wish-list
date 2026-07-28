import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { User } from '@wish-list/domain';
import type { Plain } from '@wish-list/domain';
import { Repository } from '../repository/repository.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { users } from './user.schema.js';

export class UserRepository extends Repository<User, Plain<User>, typeof users> {
  private readonly _mapper = DatabaseDomainMapper.create(User.plain, User.from);

  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: users,
    });
  }

  protected mapper(): DatabaseDomainMapper<User, Plain<User>> {
    return this._mapper;
  }
}
