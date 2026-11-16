import { Inject } from '@nestjs/common';

/** Holds the app's validated env, as parsed by `EnvModule.forRoot`. */
export const ENV = Symbol('ENV');

export const InjectEnv = (): PropertyDecorator & ParameterDecorator =>
  Inject(ENV);
