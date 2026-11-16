import { NestFactory } from '@nestjs/core';
import { ENV } from '@wish-list/common-config';
import { Failure } from '@wish-list/common-error';
import { Logger } from '@wish-list/common-logging';
import { ConsoleRenderer } from '@wish-list/common-error/renderers';
import { match, P } from 'ts-pattern';
import { AppModule } from './app/app.module.js';
import type { Env } from './config/env.js';

const GLOBAL_PREFIX = 'api';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  const env = app.get<symbol, Env>(ENV);
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  logger.log(`Listening on http://localhost:${env.PORT}/${GLOBAL_PREFIX}`);
}

bootstrap().catch((error: unknown) =>
  match(error)
    .with(
      P.when((v): v is Failure => v instanceof Failure),
      (failure) => {
        new ConsoleRenderer().print(failure);
        process.exit(1);
      },
    )
    .otherwise((unknown) => {
      throw unknown;
    }),
);
