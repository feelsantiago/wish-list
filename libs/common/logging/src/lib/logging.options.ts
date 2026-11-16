import { ConfigurableModuleBuilder } from '@nestjs/common';
import type { LevelWithSilent } from 'pino';

export interface LoggingModuleOptions {
  readonly level: LevelWithSilent;
  /** Human-readable lines through `pino-pretty`; JSON otherwise. */
  readonly pretty: boolean;
  /** Header read and echoed as the request id. Matched case-insensitively. */
  readonly requestIdHeader: string;
}

/**
 * Options live here rather than in `logging.module.ts` so that providers
 * needing `MODULE_OPTIONS_TOKEN` do not import the module that registers them.
 * Always global: `PinoFailureRenderer` and the request-bound `PinoLogger` must
 * resolve anywhere.
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<LoggingModuleOptions>()
    .setClassMethodName('forRoot')
    .setExtras({ isGlobal: true }, (definition) => ({
      ...definition,
      global: true,
    }))
    .build();
