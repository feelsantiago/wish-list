import { createRegExp, charIn, exactly, anyOf, digit } from 'magic-regexp';
import { Failure } from '@wish-list/common-error';
import { Id } from './id.js';

const hex = anyOf(digit, charIn.from('a', 'f'));
const uuidV4Pattern = createRegExp(
  hex
    .times(8)
    .at.lineStart()
    .and(exactly('-'))
    .and(hex.times(4))
    .and(exactly('-4'))
    .and(hex.times(3))
    .and(exactly('-'))
    .and(charIn('89ab'))
    .and(hex.times(3))
    .and(exactly('-'))
    .and(hex.times(12))
    .at.lineEnd(),
  ['i'],
);

describe('Id.generate', () => {
  it('returns a uuid string', () => {
    const id = Id.generate();
    expect(typeof id).toBe('string');
    expect(id).toMatch(uuidV4Pattern);
  });

  it('generates unique values', () => {
    expect(Id.generate()).not.toBe(Id.generate());
  });
});

describe('Id.create', () => {
  it('accepts valid uuid', () => {
    const id = Id.generate();
    const result = Id.create(id);
    expect(result.isOk()).toBe(true);
  });

  it('rejects non-uuid string', () => {
    const result = Id.create('not-a-uuid');
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
    expect(result.error.source).toBeInstanceOf(Failure);
    const source = result.error.source as Failure;
    expect(source.metadata['issues']).toBeDefined();
  });
});

describe('Id.from', () => {
  it('trusts the value without validation', () => {
    const id = Id.from('any-string');
    expect(id).toBe('any-string');
  });
});
