import type { Provider } from '@nestjs/common';
import { TrackedItem } from '@wish-list/domain';
import type { Plain } from '@wish-list/domain';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';

export const TRACKED_ITEM_MAPPER = Symbol('TRACKED_ITEM_MAPPER');

export function createTrackedItemMapper(): DatabaseDomainMapper<
  TrackedItem,
  Plain<TrackedItem>
> {
  return DatabaseDomainMapper.create(TrackedItem.plain, TrackedItem.from);
}

export const trackedItemMapperProvider: Provider = {
  provide: TRACKED_ITEM_MAPPER,
  useFactory: createTrackedItemMapper,
};
