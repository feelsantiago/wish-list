import type { Provider } from '@nestjs/common';
import { Option } from '@wish-list/common-result';
import { createRemoteJWKSet } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import {
  MODULE_OPTIONS_TOKEN,
  type AuthenticationModuleOptions,
} from './authentication.options.js';

export const JWKS = Symbol('JWKS');

/** Public keys Firebase ID tokens are signed with (ADR-0034). */
export const GOOGLE_SECURETOKEN_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/** The given key set, or Google's, fetched lazily and cached by `jose`. */
export const jwksProvider: Provider = {
  provide: JWKS,
  inject: [MODULE_OPTIONS_TOKEN],
  useFactory: (options: AuthenticationModuleOptions): JWTVerifyGetKey =>
    Option.from(options.jwks).unwrapOrElse(() =>
      createRemoteJWKSet(new URL(GOOGLE_SECURETOKEN_JWKS_URL)),
    ),
};
