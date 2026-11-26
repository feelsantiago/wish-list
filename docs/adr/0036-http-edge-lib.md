# The HTTP edge is a global common lib

The roadmap fixes what the HTTP edge does (decisions 6–9): one global zod validation pipe,
every response enveloped as `{ status, data }` / `{ status, error }`, controllers return
`Result`, an interceptor maps `ServiceFailure` to an HTTP status with a user-facing message,
and error bodies carry no failure tag, metadata or cause chain in production. This ADR
settles where that lives and how its open details work.

**`@wish-list/common-http` provides a global `HttpEdgeModule`** that registers, through
`APP_PIPE` / `APP_INTERCEPTOR` / `APP_FILTER`:

- **`ZodValidationPipe` from `nestjs-zod`.** Request DTOs are `createZodDto` classes. Values
  not typed with one pass through untouched.
- **`ResponseInterceptor`**, outermost. Wraps the value in `{ status: 'success' | 'created',
data }`. `created` follows a 201 response. An absent value becomes `data: null`, so deletes
  return 200 and 204 never appears.
- **`FailureInterceptor`**, inside it. Unwraps `Ok`, `Err`, `AsyncResult` and `Promise<Result>`.
  An `Err` becomes a `FailureHttpException` that keeps the original `Failure`. Plain values
  pass through, so `HealthController` needs no `Result`.
- **`FailureFilter`**, catching everything. It writes `{ status: 'error', error: { message } }`
  and logs server errors (≥ 500) through `PinoFailureRenderer.print`. Client errors are left
  to pino-http's request line.

It follows ADR-0033/0035: `ConfigurableModuleBuilder`, `forRoot`/`forRootAsync`, and the app
maps `ENV` onto the options. The module is named `HttpEdgeModule` so it doesn't clash with
`@nestjs/axios`'s `HttpModule`.

- **Status codes**: `FailureStatus` holds a `Record<ServiceFailureType, …>`. The compiler
  keeps it exhaustive over the shared vocabulary, and a service-specific tag falls through to
  500 (ADR-0020).
- **Overrides**: each tag has a generic default ("Not found", "Something went wrong").
  `@FailureResponses`, on a controller or a handler, overrides it in one of two forms. A
  **map** keyed by the failure union's tags, `@FailureResponses<WishlistFailure>({ 'slug-taken':
{ status: HttpStatus.CONFLICT, message: '…' } })`, where `status` is optional and falls back
  to the table. Or a **`FailureTranslator` class**, `@FailureResponses(WishlistFailureTranslator)`,
  whose `translate(failure)` returns the full `{ status, message }` and can read the failure's
  metadata. It delegates to `FailureStatus.response` for the defaults explicitly. Translators are
  `@Injectable`, resolved through `ModuleRef` (`strict: false`), and must be listed in the
  feature module's providers. The handler's spec is consulted first, then the class's, then the
  defaults. Map keys are typed: without a type argument they are the shared
  `ServiceFailureType`, and with one they are that union's tags. Either way a typo is a compile
  error. Because the interceptor is global, a controller with no overrides still gets correct
  statuses.
- **Validation errors** add `issues: [{ path, message }]`. They describe the caller's own
  input, not failure internals, so decision 9 doesn't apply to them.
- **`exposeFailures`** (`HTTP_EXPOSE_FAILURES`, default `false`) adds the rendered cause chain
  to error bodies for local development. This is the "in production" part of decision 9.

## Considered options

- **Inside `apps/api`** (rejected). Fewer libs, but a second app would copy the pipe,
  interceptors and filter, and the logging/config precedent is a lib.
- **A hand-written zod pipe** (rejected). Around 40 lines and no dependency, but `nestjs-zod`
  also covers the M2 OpenAPI work and already has the `createZodDto` name decision 6 uses.
- **An exhaustive message map required on every controller** (rejected). Fully typed against
  each service's failure union, but most controllers would repeat the same generic text.
- **Tag defaults only** (rejected). Simplest, but drops the user-facing message the roadmap
  asks controllers to own.
- **Message-only overrides** (rejected). A service's own tags (ADR-0020's extension point)
  could never leave 500 without the controller re-tagging each one onto a shared name.
- **A translator returning `Option`** (rejected). Shorter, but falling back to the defaults
  would be implicit.
- **A translator instantiated with `new`** (rejected). No registration, but it couldn't inject
  dependencies.
- **Global lib, map or translator overrides, an expose flag** (chosen).

## Consequences

- Every response is enveloped, `/api/health` included.
- Interceptor order is load-bearing. `ResponseInterceptor` is registered before
  `FailureInterceptor` so it wraps the unwrapped value. Reordering them envelopes a raw
  `Result`.
- `user-deactivated` (403) isn't in `ServiceFailureType` yet. It joins the `Record` when M0
  step 4 adds the tag.
- Service-specific tags (`ExtractionFailure`'s `fetch-failed`, `llm-failed`) map to 500 unless
  a `@FailureResponses` map or translator says otherwise.
- A translator referenced by `@FailureResponses` but missing from the module's providers fails
  at request time, as a logged 500, not at boot.
- `HttpEdgeModule` depends on `LoggingModule` being imported by the app for
  `PinoFailureRenderer`.
- Strict DTO declaration (`strictSchemaDeclaration`) is off: `@Param('id') id: string` stays
  unvalidated by the pipe. Turn it on once every handler takes DTOs.
