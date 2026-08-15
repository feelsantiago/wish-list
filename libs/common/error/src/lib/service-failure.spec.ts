import { describe, it, expect } from 'vitest';
import { Failure } from './failure.js';
import { ServiceFailure } from './service-failure.js';

describe('ServiceFailure.notFound', () => {
  it('creates a not-found failure carrying the id', () => {
    const f = ServiceFailure.notFound('wishlist-1');
    expect(f.name).toBe('not-found');
    expect(f.message).toContain('wishlist-1');
    expect(f.metadata).toEqual({ id: 'wishlist-1' });
    expect(f.source).toBeUndefined();
  });
});

describe('ServiceFailure.invalid', () => {
  it('wraps a domain failure, keeping it as source', () => {
    const domainFailure = Failure.create('validation', 'email is malformed');
    const f = ServiceFailure.invalid(domainFailure);
    expect(f.name).toBe('invalid');
    expect(f.source).toBe(domainFailure);
  });
});

describe('ServiceFailure.forbidden', () => {
  it('names the actor and resource', () => {
    const f = ServiceFailure.forbidden('user-1', 'wishlist-1');
    expect(f.name).toBe('forbidden');
    expect(f.metadata).toEqual({ actor: 'user-1', resource: 'wishlist-1' });
  });
});

describe('ServiceFailure.planRequired', () => {
  it('names the gated feature', () => {
    const f = ServiceFailure.planRequired('coupon-rule');
    expect(f.name).toBe('plan-required');
    expect(f.metadata).toEqual({ feature: 'coupon-rule' });
  });
});

describe('ServiceFailure.conflict', () => {
  it('carries the reason as the message', () => {
    const f = ServiceFailure.conflict('reservation already claimed');
    expect(f.name).toBe('conflict');
    expect(f.message).toBe('reservation already claimed');
  });
});

describe('ServiceFailure.unexpected', () => {
  it('wraps a native Error as source', () => {
    const err = new Error('connection refused');
    const f = ServiceFailure.unexpected(err);
    expect(f.name).toBe('unexpected');
    expect(f.source).toBe(err);
    expect(f.message).toBe('connection refused');
  });
});
