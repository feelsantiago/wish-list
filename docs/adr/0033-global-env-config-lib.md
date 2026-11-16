# Env loading is a global common lib; each app owns its schema

`apps/api` validated `process.env` with zod at bootstrap and threaded the result through
`AppModule.register(env)` into `DatabaseModule.register` and `ExtractionModule.register`.
That worked, but it had three gaps: nothing in code loaded `.env` (only Nx's task runner
did, so `node dist/main.js` booted without it), the validated `Env` could not be injected
by any provider the app adds later, and the parse → `Result` → `EnvFailure` mechanism lived
in the app, so a second app (worker, cli) would copy it.

**`@wish-list/common-config` provides a global `EnvModule.forRoot({ schema, envFilePath })`
that loads `.env` through `@nestjs/config`, parses `process.env` against the app's zod
schema, and exposes the result under the `ENV` token.** The lib holds the mechanism only;
the schema and the `Env` type stay in the app, because each app needs different variables.

Feature libs never import `@wish-list/common-config`. They keep their own
`ConfigurableModuleBuilder` options, and the app maps `Env` onto them with
`registerAsync({ inject: [ENV], useFactory })`. This keeps libs composable in any host that
can produce their options, with or without this env module.

## Considered options

- **Keep the bootstrap parse and `register(env)`** (rejected). Zero dependencies and fully
  `Result`-based, but leaves `.env` loading to the task runner and `Env` uninjectable.
- **`@nestjs/config` in the app only, read through `ConfigService`** (rejected).
  `ConfigService.get('KEY')` is string-keyed, and its `validate` hook is a second source of
  truth beside the zod schema.
- **Own loader without `@nestjs/config`** (rejected). Same shape as the chosen option, but
  re-implements `.env` parsing and precedence that the Nest package already handles.
- **Global common lib wrapping `@nestjs/config`, typed `ENV` token** (chosen).

## Consequences

- `@nestjs/config` is used only to load `.env` into `process.env`; real environment
  variables still win. Validation is the app's zod schema, run once in the `ENV` factory.
- Invalid env fails Nest boot by throwing `EnvFailure` from the factory — the one place a
  `Result` is turned into a throw, since a provider factory has no other way to abort.
  `main.ts` creates the app with `abortOnError: false` and renders the `Failure` with
  `ConsoleRenderer`, preserving the previous failure output.
- `AppModule` is a static module again; nothing outside the `ENV` factory reads
  `process.env`.
