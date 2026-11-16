# Logging is a global common lib over `nestjs-pino`

The roadmap settles on `nestjs-pino`, logging at the edge only, and a `FailureRenderer`
for structured output (ADR-0011 left that renderer unbuilt "until the logging story is
decided"). That leaves open where the wiring lives, how a request id is chosen, and how
output is controlled. `libs/extraction` is the roadmap's one exception to edge-only logging,
so logging has to reach a lib, not just the app.

**`@wish-list/common-logging` provides a global `LoggingModule` that configures
`nestjs-pino`, plus `PinoFailureRenderer implements FailureRenderer`.** `LoggingModule`
extends a `ConfigurableModuleBuilder` class (as `ExtractionModule` does), so
`forRoot`/`forRootAsync` are generated and the module has no static methods of its own. It
follows the shape of ADR-0033: the lib holds the mechanism, the app maps `ENV` onto
`{ level, pretty, requestIdHeader }`. Feature libs never import it. They log through Nest's
`Logger`, which the app points at pino with `app.useLogger(app.get(Logger))`, using the
`Logger` the lib re-exports.

Each concern is its own injectable class contributing a slice of pino-http options:
`HttpLoggingTransport` (output target), `HttpLoggingRequest` (request id),
`HttpLoggingRedact` (redaction), composed with `level` by `HttpLoggingParams`.

- **Request context** comes from `nestjs-pino`'s own `AsyncLocalStorage`. Every log line
  emitted during a request carries `req.id` without anything passing a logger down.
- **Request id**: the header is configurable (`LOG_REQUEST_ID_HEADER`, default
  `x-request-id`, validated at boot). An incoming value matching `[A-Za-z0-9_-]{1,64}` is reused,
  anything else is replaced with `crypto.randomUUID()`. The id is echoed in the same
  response header either way, so a proxy or the web client can join its own
  trace to ours. The pattern stops a client from injecting arbitrary text into log fields.
- **Redaction** censors the `authorization` and `cookie` request headers, `set-cookie`
  response headers, and `email` keys at the top level, inside failure metadata, and one
  level deeper (`DomainFailure.validation` stores the rejected input there).
- **Output**: `LOG_LEVEL` (default `info`) and `LOG_PRETTY` (default `false`) are app env
  vars. Production stays JSON on stdout; `pino-pretty` is a dev dependency, loaded only
  when `LOG_PRETTY=true`.

`PinoFailureRenderer` flattens the cause chain into `failure.chain: [{ name, message,
metadata, stack? }]`, top failure first. A flat array is queryable in a log store and lets a
single redact path cover every link. `print` logs it at `error` level; `render` returns the
same object as a JSON string. Stacks are included by default, since a JSON log has no
reader to overwhelm, and `{ stacks: false }` overrides per call.

## Considered options

- **Wiring inside `apps/api`** (rejected). Fewer libs, but `libs/extraction` couldn't share
  the renderer, and a second app (worker, cli) would copy the config.
- **`PinoFailureRenderer` on `@wish-list/common-error/renderers`** (rejected). Sits next to
  `ConsoleRenderer`, but it needs Nest DI for the request-bound logger, which would pull
  Nest into the error lib.
- **Always generating the request id** (rejected). Can't be spoofed, but breaks
  correlation with a proxy or the client.
- **Deriving format and level from `NODE_ENV`** (rejected). One less variable, but implicit,
  and it can't raise the level in production without a deploy.
- **Global common lib, validated incoming id, explicit env vars** (chosen).

## Consequences

- Nothing calls `PinoFailureRenderer.print` yet. The global failure filter (M0 step 3) is
  its first caller.
- pino-http logs one line per completed request, health checks included. Filter them later
  if they get noisy.
- Redact paths are explicit. An `email` nested deeper than the listed paths is not
  censored. This is acceptable while no failure carries one deeper; new metadata shapes
  that do must add a path.
- nestjs-pino builds its pino-http middleware once per process. One app per process is the
  production shape, but a test that boots two apps with different options in one file gets
  the first app's middleware. Such tests go in separate spec files.
- Boot failures before the logger exists (invalid env) still go through `ConsoleRenderer`
  in `main.ts`, unchanged from ADR-0033.
