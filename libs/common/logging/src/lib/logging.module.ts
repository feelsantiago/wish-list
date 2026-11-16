import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { HttpLoggingParams } from './http-logging-params.js';
import { HttpLoggingRedact } from './http-logging-redact.js';
import { HttpLoggingRequest } from './http-logging-request.js';
import { HttpLoggingTransport } from './http-logging-transport.js';
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from './logging.options.js';
import { PinoFailureRenderer } from './pino-failure-renderer.js';

/**
 * Feature libs never import this module — they log through Nest's `Logger`,
 * which the app points at pino with `app.useLogger(app.get(Logger))` (ADR-0035).
 * The Http* providers live in nestjs-pino's params scope and read the options
 * through this global module's export.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      providers: [
        HttpLoggingTransport,
        HttpLoggingRequest,
        HttpLoggingRedact,
        HttpLoggingParams,
      ],
      inject: [HttpLoggingParams],
      useFactory: (params: HttpLoggingParams) => params.build(),
    }),
  ],
  providers: [PinoFailureRenderer],
  exports: [PinoFailureRenderer, MODULE_OPTIONS_TOKEN],
})
export class LoggingModule extends ConfigurableModuleClass {}
