import { ConfigurableModuleBuilder } from '@nestjs/common';

export interface HttpEdgeModuleOptions {
  /**
   * Adds the failure's cause chain to error bodies. Off in production: error
   * bodies carry no tag, metadata or chain (ROADMAP decision 9).
   */
  readonly exposeFailures: boolean;
}

/**
 * Options live here rather than in `http-edge.module.ts` so that providers
 * needing `MODULE_OPTIONS_TOKEN` do not import the module that registers them.
 * Always global: the pipe, interceptors and filter are app-wide anyway.
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<HttpEdgeModuleOptions>()
    .setClassMethodName('forRoot')
    .setExtras({ isGlobal: true }, (definition) => ({
      ...definition,
      global: true,
    }))
    .build();
