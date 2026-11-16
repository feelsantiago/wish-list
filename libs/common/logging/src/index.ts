export { LoggingModule } from './lib/logging.module.js';
export type { LoggingModuleOptions } from './lib/logging.options.js';
export { HttpLoggingTransport } from './lib/http-logging-transport.js';
export { HttpLoggingRequest } from './lib/http-logging-request.js';
export { HttpLoggingRedact } from './lib/http-logging-redact.js';
export { HttpLoggingParams } from './lib/http-logging-params.js';
export { PinoFailureRenderer } from './lib/pino-failure-renderer.js';
export type {
  FailureLink,
  RenderedFailure,
} from './lib/pino-failure-renderer.js';
/** The app hands this to `app.useLogger` so Nest's `Logger` writes through pino. */
export { Logger } from 'nestjs-pino';
