import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConsoleRenderer } from '@wish-list/common-error/renderers';
import { AppModule } from './app/app.module.js';
import { Env } from './config/env.js';

const GLOBAL_PREFIX = 'api';

async function bootstrap(env: Env): Promise<void> {
  const app = await NestFactory.create(AppModule.register(env));
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  Logger.log(`Listening on http://localhost:${env.PORT}/${GLOBAL_PREFIX}`);
}

Env.load(process.env).match({
  ok: (env) => void bootstrap(env),
  err: (failure) => {
    new ConsoleRenderer().print(failure);
    process.exit(1);
  },
});
