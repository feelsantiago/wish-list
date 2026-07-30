import type { Provider } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { createDatabaseClient } from './client.js';
import { DATABASE_CLIENT } from './client.token.js';
import { MODULE_OPTIONS_TOKEN } from '../database.module.js';
import type { DatabaseModuleOptions } from '../database.module.js';

export const clientProvider: Provider = {
  provide: DATABASE_CLIENT,
  useFactory: (options: DatabaseModuleOptions): LibSQLDatabase =>
    createDatabaseClient(options.url),
  inject: [MODULE_OPTIONS_TOKEN],
};
