import { Failure } from '@wish-list/common-error';
import { TimeWindow } from './time-window.js';

describe('TimeWindow.create', () => {
  it('accepts positive finite number', () => {
    const result = TimeWindow.create(1000);
    expect(result.isOk()).toBe(true);
  });

  it('rejects zero', () => {
    const result = TimeWindow.create(0);
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
    expect(result.error.source).toBeInstanceOf(Failure);
  });

  it('rejects negative numbers', () => {
    const result = TimeWindow.create(-1000);
    expect(result.isErr()).toBe(true);
  });

  it('rejects non-finite numbers', () => {
    const result = TimeWindow.create(Infinity);
    expect(result.isErr()).toBe(true);
  });
});

describe('TimeWindow.from', () => {
  it('trusts the value without validation', () => {
    const timeWindow = TimeWindow.from(-1);
    expect(timeWindow).toBe(-1);
  });
});
