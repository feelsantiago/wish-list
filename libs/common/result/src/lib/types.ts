import type { Result } from './result.js';

export type ResultAsync<T, E> = Promise<Result<T, E>>;
