import { Id } from '../id/id.js';
import { Category } from './category.js';

describe('Category.create', () => {
  const user = Id.generate();

  it('with color produces Option.some(color)', () => {
    const result = Category.create({ user, name: 'Groceries', color: '#ff0000' });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const category = result.value;
    expect(category.user).toBe(user);
    expect(category.name).toBe('Groceries');
    expect(category.color.isSome()).toBe(true);
    expect(category.color.unwrapOr('')).toBe('#ff0000');
  });

  it('without color produces Option.none()', () => {
    const result = Category.create({ user, name: 'Groceries' });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.color.isNone()).toBe(true);
  });

  it('rejects malformed hex color', () => {
    const result = Category.create({ user, name: 'Groceries', color: 'red' });
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
  });

  it('rejects an empty name', () => {
    const result = Category.create({ user, name: '' });
    expect(result.isErr()).toBe(true);
  });
});

describe('Category round-trip', () => {
  const user = Id.generate();

  it('round-trips a colored Category', () => {
    const result = Category.create({ user, name: 'Groceries', color: '#00ff00' });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const category = result.value;
    expect(Category.from(Category.plain(category))).toEqual(category);
  });

  it('round-trips a colorless Category', () => {
    const result = Category.create({ user, name: 'Groceries' });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const category = result.value;
    expect(Category.from(Category.plain(category))).toEqual(category);
  });
});
