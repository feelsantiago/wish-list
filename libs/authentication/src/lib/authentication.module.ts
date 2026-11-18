import { Module } from '@nestjs/common';
import { ConfigurableModuleClass } from './authentication.options.js';
import { IdentityVerifier } from './identity-verifier.js';
import { jwksProvider } from './jwks.provider.js';

/**
 * Verifies Firebase ID tokens into an `Identity` (ADR-0038). Global; the app
 * registers it once and maps `ENV.FIREBASE_PROJECT_ID` onto `projectId`.
 */
@Module({
  providers: [jwksProvider, IdentityVerifier],
  exports: [IdentityVerifier],
})
export class AuthenticationModule extends ConfigurableModuleClass {}
