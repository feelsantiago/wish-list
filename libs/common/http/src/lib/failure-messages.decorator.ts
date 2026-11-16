import { Reflector } from '@nestjs/core';
import type { ServiceFailureType } from '@wish-list/common-error/service';

/**
 * Overrides the default user-facing message per failure tag, on a controller
 * or a handler; the handler's entry wins.
 *
 * @example `@FailureMessages({ 'not-found': 'Wishlist not found' })`
 */
export const FailureMessages =
  Reflector.createDecorator<Partial<Record<ServiceFailureType, string>>>();
