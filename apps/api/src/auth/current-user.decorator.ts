import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ActiveUser } from '@wish-list/domain';
import type { AuthenticatedRequest } from './authenticated-request.js';

/**
 * The `ActiveUser` the global `AuthGuard` resolved. Only meaningful on
 * protected routes; a `@Public()` route has no user.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): ActiveUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
