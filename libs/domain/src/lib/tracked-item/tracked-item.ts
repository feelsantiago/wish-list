import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';

export interface TrackedItem {
  readonly id: Id;
  readonly item: Id;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export namespace TrackedItem {
  export function create(item: Id): TrackedItem {
    const now = new Date();
    return {
      id: Id.generate(),
      item,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  export function stop(trackedItem: TrackedItem): TrackedItem {
    return {
      ...trackedItem,
      active: false,
      updatedAt: new Date(),
    };
  }

  export function resume(trackedItem: TrackedItem): TrackedItem {
    return {
      ...trackedItem,
      active: true,
      updatedAt: new Date(),
    };
  }

  export function from(plain: Plain<TrackedItem>): TrackedItem {
    return {
      id: plain.id as Id,
      item: plain.item as Id,
      active: plain.active,
      createdAt: new Date(plain.createdAt),
      updatedAt: new Date(plain.updatedAt),
    };
  }

  export function plain(trackedItem: TrackedItem): Plain<TrackedItem> {
    return {
      id: trackedItem.id,
      item: trackedItem.item,
      active: trackedItem.active,
      createdAt: trackedItem.createdAt.toISOString(),
      updatedAt: trackedItem.updatedAt.toISOString(),
    };
  }
}
