import type { ActiveUser } from '@wish-list/domain';

/**
 * The slice of the HTTP request the guard reads and writes: the
 * `Authorization` header in, the resolved `ActiveUser` out.
 */
export interface AuthenticatedRequest {
  readonly headers: { readonly authorization?: string };
  user: ActiveUser;
}
