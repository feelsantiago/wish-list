import { ConfigurableModuleBuilder } from '@nestjs/common';
import type { JWTVerifyGetKey } from 'jose';

export interface AuthenticationModuleOptions {
  /** Firebase project id: the token's `aud`, and the suffix of its `iss` (ADR-0034). */
  readonly projectId: string;
  /**
   * Key set the token signature is checked against. Defaults to Google's
   * securetoken JWKS; tests pass a `createLocalJWKSet` (ADR-0038).
   */
  readonly jwks?: JWTVerifyGetKey;
}

/** Always global, like the other app-wide modules (ADR-0033, ADR-0036). */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<AuthenticationModuleOptions>()
    .setClassMethodName('forRoot')
    .setExtras({ isGlobal: true }, (definition) => ({
      ...definition,
      global: true,
    }))
    .build();
