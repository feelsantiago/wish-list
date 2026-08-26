import { describe, it, expect } from 'vitest';
import { DatabaseModule } from '../database.module.js';
import { MODULE_OPTIONS_TOKEN } from '../database.options.js';
import { DATABASE_CLIENT } from './client.token.js';
import { clientProvider } from './client.provider.js';

describe('clientProvider', () => {
  it('provides the database client', () => {
    expect(clientProvider).toMatchObject({ provide: DATABASE_CLIENT });
  });

  /**
   * Regression: while the options token lived in database.module.ts, importing
   * the module evaluated this provider first and injected `undefined`.
   */
  it('injects the module options token even when the module is imported first', () => {
    expect(DatabaseModule).toBeDefined();
    expect(clientProvider).toMatchObject({ inject: [MODULE_OPTIONS_TOKEN] });
    expect(MODULE_OPTIONS_TOKEN).toBeDefined();
  });
});
