import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { databaseTestingProviders } from './providers.js';

export function createTestingModule(
  db: LibSQLDatabase,
): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: databaseTestingProviders(db),
  }).compile();
}
