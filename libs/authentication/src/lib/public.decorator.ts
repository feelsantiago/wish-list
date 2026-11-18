import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';

/** Metadata key the app's guard reads to skip authentication. */
export const IS_PUBLIC = 'authentication:public';

/**
 * Marks a route or controller as reachable without a token. Every other
 * route needs one, because the guard is global (ADR-0038).
 */
export function Public(): CustomDecorator<string> {
  return SetMetadata(IS_PUBLIC, true);
}
