import { Id } from '../id/id.js';
import { TrackedItem } from './tracked-item.js';

describe('TrackedItem.create', () => {
  it('generates id, stamps createdAt/updatedAt, defaults active to true', () => {
    const item = Id.generate();
    const trackedItem = TrackedItem.create(item);
    expect(trackedItem.id).toBeTruthy();
    expect(trackedItem.item).toBe(item);
    expect(trackedItem.active).toBe(true);
    expect(trackedItem.createdAt).toBeInstanceOf(Date);
    expect(trackedItem.updatedAt).toBeInstanceOf(Date);
  });
});

describe('TrackedItem.stop', () => {
  it('flips active to false, refreshes updatedAt, leaves id/item/createdAt unchanged', () => {
    const trackedItem = TrackedItem.create(Id.generate());
    const stopped = TrackedItem.stop(trackedItem);
    expect(stopped.active).toBe(false);
    expect(stopped.id).toBe(trackedItem.id);
    expect(stopped.item).toBe(trackedItem.item);
    expect(stopped.createdAt).toBe(trackedItem.createdAt);
    expect(stopped.updatedAt).not.toBe(trackedItem.updatedAt);
  });
});

describe('TrackedItem.resume', () => {
  it('flips active to true, refreshes updatedAt, leaves id/item/createdAt unchanged', () => {
    const trackedItem = TrackedItem.stop(TrackedItem.create(Id.generate()));
    const resumed = TrackedItem.resume(trackedItem);
    expect(resumed.active).toBe(true);
    expect(resumed.id).toBe(trackedItem.id);
    expect(resumed.item).toBe(trackedItem.item);
    expect(resumed.createdAt).toBe(trackedItem.createdAt);
    expect(resumed.updatedAt).not.toBe(trackedItem.updatedAt);
  });
});

describe('TrackedItem round-trip', () => {
  it('TrackedItem.from(TrackedItem.plain(trackedItem)) deep-equals the original', () => {
    const trackedItem = TrackedItem.create(Id.generate());
    expect(TrackedItem.from(TrackedItem.plain(trackedItem))).toEqual(
      trackedItem,
    );
  });
});
