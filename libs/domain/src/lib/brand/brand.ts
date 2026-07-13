declare const BrandTag: unique symbol;

export type Brand<Base, Tag extends string> = Base & {
  readonly [BrandTag]: { readonly [K in Tag]: true };
};

export type Unbrand<T> = T extends Brand<infer Base, string> ? Base : T;
