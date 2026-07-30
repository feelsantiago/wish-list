import { Inject, Injectable } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { User } from '@wish-list/domain';
import type { Plain } from '@wish-list/domain';
import { Repository } from '../repository/repository.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DATABASE_CLIENT } from '../database-client.token.js';
import { USER_MAPPER } from './user.mapper.js';
import { users } from './user.schema.js';

@Injectable()
export class UserRepository extends Repository<User, Plain<User>, typeof users> {
  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(USER_MAPPER)
    private readonly _mapper: DatabaseDomainMapper<User, Plain<User>>,
  ) {
    super({
      db,
      table: users,
    });
  }

  protected mapper(): DatabaseDomainMapper<User, Plain<User>> {
    return this._mapper;
  }
}
