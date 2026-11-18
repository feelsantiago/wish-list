import { Option } from '@wish-list/common-result';
import { Identity } from './identity.js';

describe('Identity.create', () => {
  const valid = {
    providerId: 'uid-1',
    provider: 'google',
    email: 'Ada@Example.com',
    name: Option.some('Ada Lovelace'),
  };

  it('builds an Identity with a lowercased Email', () => {
    const result = Identity.create(valid);
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.providerId).toBe('uid-1');
    expect(result.value.provider).toBe('google');
    expect(result.value.email).toBe('ada@example.com');
    expect(result.value.name.unwrapOr('')).toBe('Ada Lovelace');
  });

  it('keeps an absent name absent', () => {
    const result = Identity.create({ ...valid, name: Option.none() });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.name.isNone()).toBe(true);
  });

  it('treats a blank name as absent', () => {
    const result = Identity.create({ ...valid, name: Option.some('   ') });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.name.isNone()).toBe(true);
  });

  it('trims the name', () => {
    const result = Identity.create({ ...valid, name: Option.some(' Ada ') });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.name.unwrapOr('')).toBe('Ada');
  });

  it.each([
    ['an invalid email', { email: 'not-an-email' }],
    ['an empty providerId', { providerId: '' }],
    ['an empty provider', { provider: '' }],
  ])('rejects %s', (_, override) => {
    const result = Identity.create({ ...valid, ...override });
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
  });
});
