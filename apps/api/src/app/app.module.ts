import { Module } from '@nestjs/common';
import { ENV, EnvModule } from '@wish-list/common-config';
import { HttpEdgeModule } from '@wish-list/common-http';
import { LoggingModule } from '@wish-list/common-logging';
import { DatabaseModule } from '@wish-list/database';
import { ExtractionModule } from '@wish-list/extraction';
import { Env } from '../config/env.js';
import { HealthController } from '../health/health.controller.js';

/** Resolved against the workspace root, where `nx serve` runs the bundle. */
const ENV_FILE_PATH = 'apps/api/.env';

@Module({
  imports: [
    EnvModule.forRoot({ schema: Env.$, envFilePath: ENV_FILE_PATH }),
    LoggingModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        level: env.LOG_LEVEL,
        pretty: env.LOG_PRETTY,
        requestIdHeader: env.LOG_REQUEST_ID_HEADER,
      }),
    }),
    HttpEdgeModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ exposeFailures: env.HTTP_EXPOSE_FAILURES }),
    }),
    DatabaseModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ url: env.DATABASE_URL }),
    }),
    ExtractionModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        markdownCap: env.EXTRACTION_MARKDOWN_CAP,
        budget: env.EXTRACTION_BUDGET_MS,
        llm: { apiKey: env.LLM_API_KEY, model: env.LLM_MODEL },
        freshness: env.EXTRACTION_FRESHNESS_MS,
        failureWindow: env.EXTRACTION_FAILURE_WINDOW_MS,
      }),
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
