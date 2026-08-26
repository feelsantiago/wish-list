import { ConfigurableModuleBuilder } from '@nestjs/common';

export interface DatabaseModuleOptions {
  url: string;
}

/**
 * Options live here rather than in `database.module.ts` so that providers
 * needing `MODULE_OPTIONS_TOKEN` do not import the module that registers them.
 * Under that cycle the provider's module body runs first and reads the token
 * before it is initialized — `inject: [undefined]`, with no error until Nest
 * fails to resolve the dependency at boot.
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<DatabaseModuleOptions>().build();
