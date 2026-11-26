import { createClient } from '@libsql/client';
import { Option } from '@wish-list/common-result';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabaseClient } from './client.js';

vi.mock('@libsql/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@libsql/client')>();
  return { ...actual, createClient: vi.fn(actual.createClient) };
});

describe('createDatabaseClient', () => {
  afterEach(() => {
    vi.mocked(createClient).mockClear();
  });

  it('passes the auth token to libsql when one is given', () => {
    createDatabaseClient({ url: ':memory:', authToken: Option.some('token') });

    expect(createClient).toHaveBeenCalledWith({
      url: ':memory:',
      authToken: 'token',
    });
  });

  it('omits the auth token when there is none', () => {
    createDatabaseClient({ url: ':memory:', authToken: Option.none() });

    expect(createClient).toHaveBeenCalledWith({ url: ':memory:' });
  });
});
