import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'turso',
  schema: './src/lib/**/*.schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'file:./local.db',
    authToken: process.env['DATABASE_AUTH_TOKEN'],
  },
});
