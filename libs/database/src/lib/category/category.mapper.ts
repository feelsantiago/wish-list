import type { Provider } from '@nestjs/common';
import { Category } from '@wish-list/domain';
import type { Plain } from '@wish-list/domain';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';

export const CATEGORY_MAPPER = Symbol('CATEGORY_MAPPER');

export function createCategoryMapper(): DatabaseDomainMapper<
  Category,
  Plain<Category>
> {
  return DatabaseDomainMapper.create(Category.plain, Category.from);
}

export const categoryMapperProvider: Provider = {
  provide: CATEGORY_MAPPER,
  useFactory: createCategoryMapper,
};
