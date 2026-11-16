import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { DatabaseModule } from '@wish-list/database';
import { ExtractionModule } from '@wish-list/extraction';
import type { Env } from '../config/env.js';
import { HealthController } from '../health/health.controller.js';

@Module({})
export class AppModule {
  public static register(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DatabaseModule.register({ url: env.DATABASE_URL }),
        ExtractionModule.register({
          markdownCap: env.EXTRACTION_MARKDOWN_CAP,
          budget: env.EXTRACTION_BUDGET_MS,
          llm: { apiKey: env.LLM_API_KEY, model: env.LLM_MODEL },
          freshness: env.EXTRACTION_FRESHNESS_MS,
          failureWindow: env.EXTRACTION_FAILURE_WINDOW_MS,
        }),
      ],
      controllers: [HealthController],
    };
  }
}
