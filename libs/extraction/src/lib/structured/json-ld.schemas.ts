import { z } from 'zod';
import { match, P } from 'ts-pattern';
import { Option } from '@wish-list/common-result';

export const jsonLdOffer$ = z.object({
  price: z.union([z.string(), z.number()]).optional(),
  priceCurrency: z.string().optional(),
  lowPrice: z.union([z.string(), z.number()]).optional(),
});
export type JsonLdOffer = z.infer<typeof jsonLdOffer$>;

export const jsonLdOffers$ = z
  .union([jsonLdOffer$, z.array(jsonLdOffer$)])
  .optional()
  .transform((offers): Option<JsonLdOffer> =>
    match(offers)
      .with(undefined, () => Option.none<JsonLdOffer>())
      .with(P.array(P._), (arr) => Option.from(arr[0]))
      .otherwise((offer) => Option.some(offer)),
  );

export const jsonLdImage$ = z
  .union([
    z.string(),
    z.array(z.string()),
    z.object({ url: z.string().optional() }),
  ])
  .optional()
  .transform((image): Option<string> =>
    match(image)
      .with(undefined, () => Option.none<string>())
      .with(P.string, (value) => Option.some(value))
      .with(P.array(P.string), (arr) => Option.from(arr[0]))
      .otherwise((obj) => Option.from(obj.url)),
  );

export const jsonLdBrand$ = z
  .union([z.string(), z.object({ name: z.string().optional() })])
  .optional()
  .transform((brand): Option<string> =>
    match(brand)
      .with(undefined, () => Option.none<string>())
      .with(P.string, (value) => Option.some(value))
      .otherwise((obj) => Option.from(obj.name)),
  );

export const jsonLdProduct$ = z.object({
  name: z.string().optional().transform(Option.from),
  image: jsonLdImage$,
  offers: jsonLdOffers$,
  brand: jsonLdBrand$,
});

export type JsonLdProduct = z.infer<typeof jsonLdProduct$>;
