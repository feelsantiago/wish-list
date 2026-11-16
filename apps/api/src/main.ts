import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ENV } from '@wish-list/common-config';
import { Failure } from '@wish-list/common-error';
import { ConsoleRenderer } from '@wish-list/common-error/renderers';
import { match, P } from 'ts-pattern';
import { AppModule } from './app/app.module.js';
import type { Env } from './config/env.js';

const GLOBAL_PREFIX = 'api';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  const env = app.get<symbol, Env>(ENV);
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  Logger.log(`Listening on http://localhost:${env.PORT}/${GLOBAL_PREFIX}`);
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
