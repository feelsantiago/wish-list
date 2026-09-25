import type { Brand } from '../brand/brand.js';

export type UserAuthorized<T> = T & Brand<T, `authorized:${keyof T & string}`>;
