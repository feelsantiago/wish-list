import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Result } from '@wish-list/common-result';
import type { z, ZodError } from 'zod';
import { EnvFailure } from './env-failure.js';
import { ENV } from './env.token.js';

export interface EnvModuleOptions<S extends z.ZodTypeAny> {
  /** The app's env schema; the lib owns loading, never the variables. */
  readonly schema: S;
  /** `.env` file merged into `process.env`. Real environment variables win. */
  readonly envFilePath: string;
}

/**
 * Global so every module injects the same parsed env via `ENV`. Feature libs
 * never import this module — the app maps `ENV` onto their options with
 * `registerAsync`.
 */
@Module({})
export class EnvModule {
  public static forRoot<S extends z.ZodTypeAny>(
    options: EnvModuleOptions<S>,
  ): DynamicModule {
    return {
      module: EnvModule,
      global: true,
      imports: [ConfigModule.forRoot({ envFilePath: options.envFilePath })],
      providers: [
        {
          provide: ENV,
          useFactory: async (): Promise<z.infer<S>> => {
            await ConfigModule.envVariablesLoaded;
            return EnvModule.parse(options.schema, process.env);
          },
        },
      ],
      exports: [ENV],
    };
  }

  /** Throwing is the only way a provider factory can abort Nest boot. */
  private static parse<S extends z.ZodTypeAny>(
    schema: S,
    source: NodeJS.ProcessEnv,
  ): z.infer<S> {
    return Result.fromThrowable<z.infer<S>, ZodError>(() => schema.parse(source))
      .mapErr(EnvFailure.invalid)
      .match({
        ok: (env) => env,
        err: (failure) => {
          throw failure;
        },
      });
  }
}
