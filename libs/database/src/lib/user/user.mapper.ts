import type { Provider } from '@nestjs/common';
import { User } from '@wish-list/domain';
import type { Plain } from '@wish-list/domain';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';

export const USER_MAPPER = Symbol('USER_MAPPER');

export function createUserMapper(): DatabaseDomainMapper<User, Plain<User>> {
  return DatabaseDomainMapper.create(User.plain, User.from);
}

export const userMapperProvider: Provider = {
  provide: USER_MAPPER,
  useFactory: createUserMapper,
};
